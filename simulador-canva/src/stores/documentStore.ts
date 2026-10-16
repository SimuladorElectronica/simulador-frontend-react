import type { CircuitDocument, ComponentInstance, Wire, PinReference, SimulationProjection } from '@types';
import { ManifestRegistry } from '../core/registry/manifestRegistry';

export class DocumentStore {
    private document: CircuitDocument;
    private listeners = new Set<() => void>();
    private lastProjectionHash: string = '';

    constructor() {
        this.document = {
            formatVersion: 1,
            components: [],
            wires: [],
            programs: [],
            meta: { name: 'Proyecto Sin Título', createdAt: Date.now(), updatedAt: Date.now() },
        };
    }

    public getDocument(): CircuitDocument {
        return this.document;
    }

    // Modificación de UI (No altera el hash topológico)
    public updateComponentPosition(id: string, x: number, y: number) {
        const comp = this.document.components.find((c) => c.id === id);
        if (comp) {
            comp.position = { x, y };
            this.notifyUI();
        }
    }

    // Modificación de Topología (Altera el hash topológico)
    public addComponent(type: string, position: { x: number; y: number }) {
        const manifest = ManifestRegistry.get(type);
        if (!manifest) throw new Error(`Tipo de componente desconocido: ${type}`);

        const newInst: ComponentInstance = {
            id: `${manifest.category.toLowerCase()}_${Date.now()}`,
            type,
            position,
            params: {},
        };

        this.document.components.push(newInst);
        this.notifyUI();
    }

    public addWire(from: PinReference, to: PinReference, color: string = '#e74c3c') {
        const newWire: Wire = {
            id: `wire_${Date.now()}`,
            from,
            to,
            color,
        };

        this.document.wires.push(newWire);
        this.notifyUI();
    }

    public getSimulationProjection(): SimulationProjection {
        return {
            components: this.document.components.map(({ id, type, params }) => ({ id, type, params })),
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
        this.listeners.forEach((listener) => listener());
    }
}

export const documentStore = new DocumentStore();