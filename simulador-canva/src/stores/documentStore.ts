import type { CircuitDocument, ComponentInstance, Wire, PinReference, SimulationProjection } from '@types';
import { ManifestRegistry } from '../core/registry/manifestRegistry';

export class DocumentStore {
    private document: CircuitDocument;
    /**
     * Vista inmutable (con sharing estructural) del documento, pensada para React.
     * Se reconstruye en cada cambio y su referencia solo cambia entonces, lo que
     * permite usar `useSyncExternalStore` y que React Compiler memoice correctamente
     * (con el documento vivo mutado en sitio, las referencias nunca cambian y los
     * hijos memoizados no se re-renderizaban).
     */
    private snapshot: CircuitDocument;
    private listeners = new Set<() => void>();
    private lastProjectionHash: string = '';
    private instanceCounter: number = 0;
    private wireCounter: number = 0;

    constructor() {
        this.document = {
            formatVersion: 1,
            components: [],
            wires: [],
            programs: [],
            meta: { name: 'Proyecto Sin Título', createdAt: Date.now(), updatedAt: Date.now() },
        };
        this.snapshot = this.buildSnapshot();
    }

    /**
     * Documento "vivo": se muta en sitio. Es la fuente de verdad del dominio
     * (los tests del hito H1 dependen de esta semántica). La UI debe consumir
     * `getSnapshot()` en su lugar.
     */
    public getDocument(): CircuitDocument {
        return this.document;
    }

    /**
     * Documento inmutable para la capa de vista (React). La referencia solo
     * cambia cuando el documento cambia, requisito de `useSyncExternalStore`.
     */
    public getSnapshot(): CircuitDocument {
        return this.snapshot;
    }

    private buildSnapshot(): CircuitDocument {
        return {
            ...this.document,
            components: this.document.components.map((c) => ({
                ...c,
                position: { ...c.position },
                params: { ...c.params },
            })),
            wires: this.document.wires.map((w) => ({ ...w, from: { ...w.from }, to: { ...w.to } })),
            programs: this.document.programs,
            meta: { ...this.document.meta },
        };
    }

    // Modificación de UI
    public updateComponentPosition(id: string, x: number, y: number) {
        const comp = this.document.components.find((c) => c.id === id);
        if (comp) {
            comp.position = { x, y };
            this.notifyUI();
        }
    }

    // Modificación de Topología
    public addComponent(type: string, position: { x: number; y: number }): ComponentInstance {
        const manifest = ManifestRegistry.get(type);
        if (!manifest) throw new Error(`Tipo de componente desconocido: ${type}`);

        // Inicializar params con los defaults declarados en el manifiesto (si los hay)
        const params: Record<string, number | string | boolean> = {};
        for (const [key, spec] of Object.entries(manifest.parameters ?? {})) {
            params[key] = spec.default;
        }

        const newInst: ComponentInstance = {
            id: `${manifest.category.toLowerCase().replace(/[^a-z0-9]+/g, '')}_${++this.instanceCounter}`,
            type,
            position,
            params,
        };

        this.document.components.push(newInst);
        this.notifyUI();
        return newInst;
    }

    public removeComponent(id: string) {
        const before = this.document.components.length;
        this.document.components = this.document.components.filter((c) => c.id !== id);
        if (this.document.components.length === before) return;

        // Los cables huérfanos se eliminan junto con el componente
        this.document.wires = this.document.wires.filter(
            (w) => w.from.componentId !== id && w.to.componentId !== id,
        );
        this.notifyUI();
    }

    public getComponent(id: string): ComponentInstance | undefined {
        return this.document.components.find((c) => c.id === id);
    }

    public addWire(from: PinReference, to: PinReference, color: string = '#e74c3c'): Wire | undefined {
        if (!this.isValidConnection(from, to)) return undefined;

        const newWire: Wire = {
            id: `wire_${++this.wireCounter}`,
            from,
            to,
            color,
        };

        this.document.wires.push(newWire);
        this.notifyUI();
        return newWire;
    }

    public removeWire(id: string) {
        const before = this.document.wires.length;
        this.document.wires = this.document.wires.filter((w) => w.id !== id);
        if (this.document.wires.length === before) return;
        this.notifyUI();
    }

    public getWire(id: string): Wire | undefined {
        return this.document.wires.find((w) => w.id === id);
    }

    /**
     * Reglas de validez de una conexión:
     *  - Ambos componentes existen y tienen manifiesto registrado.
     *  - Ambos pines existen en sus manifiestos respectivos.
     *  - No es el mismo pin consigo mismo.
     *  - No existe ya un cable con la misma pareja de pines (en cualquier dirección).
     */
    public isValidConnection(from: PinReference, to: PinReference): boolean {
        if (from.componentId === to.componentId && from.pinId === to.pinId) return false;

        const fromComp = this.getComponent(from.componentId);
        const toComp = this.getComponent(to.componentId);
        if (!fromComp || !toComp) return false;

        const fromManifest = ManifestRegistry.get(fromComp.type);
        const toManifest = ManifestRegistry.get(toComp.type);
        if (!fromManifest || !toManifest) return false;

        if (!fromManifest.pins.some((p) => p.id === from.pinId)) return false;
        if (!toManifest.pins.some((p) => p.id === to.pinId)) return false;

        const duplicated = this.document.wires.some(
            (w) =>
                (w.from.componentId === from.componentId &&
                    w.from.pinId === from.pinId &&
                    w.to.componentId === to.componentId &&
                    w.to.pinId === to.pinId) ||
                (w.from.componentId === to.componentId &&
                    w.from.pinId === to.pinId &&
                    w.to.componentId === from.componentId &&
                    w.to.pinId === from.pinId),
        );
        return !duplicated;
    }

    public getSimulationProjection(): SimulationProjection {
        return {
            // Los tipos sin manifiesto registrado se tratan como ausentes para el Worker
            components: this.document.components
                .filter((c) => ManifestRegistry.get(c.type))
                .map(({ id, type, params }) => ({ id, type, params })),
            wires: this.document.wires,
            programs: this.document.programs,
        };
    }

    public getProjectionHash(): string {
        return JSON.stringify(this.getSimulationProjection());
    }

    // Verifica si el cambio requiere envío al Worker
    public hasTopologyChanged(): boolean {
        const currentHash = this.getProjectionHash();
        if (currentHash === this.lastProjectionHash) {
            return false;
        }
        this.lastProjectionHash = currentHash;
        return true;
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyUI() {
        // Primero se congela una nueva vista inmutable; los listeners (React)
        // leerán `getSnapshot()` y obtendrán una referencia nueva.
        this.snapshot = this.buildSnapshot();
        this.listeners.forEach((listener) => listener());
    }
}

export const documentStore = new DocumentStore();