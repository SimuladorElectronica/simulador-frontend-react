import type {
    PinReference,
    SimulationProjection,
    Netlist,
    ComponentManifest,
} from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';

/**
 * NetlistBuilder convierte una SimulationProjection en un Netlist
 * apto para el solver nodal.
 *
 * Responsabilidades:
 *  1. Resolver internalGroups de cada manifiesto (pines equipotenciales internos,
 *     ej. GND de la ESP32 o filas de la protoboard) fusionándolos en un mismo net.
 *  2. Aplicar los cables (Wire) del documento para unir pines entre componentes.
 *  3. Emitir elements con terminals mapeando rol → netId, usando los params del manifiesto.
 */

class UnionFind {
    public parent = new Map<string, string>();

    public find(key: string): string {
        if (!this.parent.has(key)) {
            this.parent.set(key, key);
        }
        let root = key;
        while (this.parent.get(root) !== root) {
            root = this.parent.get(root)!;
        }
        let current = key;
        while (this.parent.get(current) !== root) {
            const next = this.parent.get(current)!;
            this.parent.set(current, root);
            current = next;
        }
        return root;
    }

    public union(a: string, b: string): void {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra !== rb) {
            this.parent.set(rb, ra);
        }
    }

    public groups(): Map<string, string[]> {
        const groups = new Map<string, string[]>();
        for (const key of this.parent.keys()) {
            const root = this.find(key);
            const arr = groups.get(root) ?? [];
            arr.push(key);
            groups.set(root, arr);
        }
        return groups;
    }
}

function pinKey(componentId: string, pinId: string): string {
    return `${componentId}|${pinId}`;
}

/**
 * Construye un Netlist a partir de la proyección de simulación y los manifiestos
 * registrados en el ManifestRegistry.
 *
 * Los componentes sin manifiesto se ignoran (coherente con getSimulationProjection).
 */
export function buildNetlist(
    projection: SimulationProjection,
    manifests: ComponentManifest[] = ManifestRegistry.getAll(),
): Netlist {
    const manifestById = new Map<string, ComponentManifest>();
    for (const m of manifests) {
        manifestById.set(m.id, m);
    }

    const uf = new UnionFind();

    // Registrar todos los pines de todos los componentes en la unión-find.
    for (const comp of projection.components) {
        const manifest = manifestById.get(comp.type);
        if (!manifest) continue;
        for (const pin of manifest.pins) {
            uf.parent.set(pinKey(comp.id, pin.id), pinKey(comp.id, pin.id));
        }
    }

    // Fusionar internalGroups de cada manifiesto (pines equipotenciales internos).
    for (const comp of projection.components) {
        const manifest = manifestById.get(comp.type);
        if (!manifest || !manifest.internalGroups) continue;
        for (const group of manifest.internalGroups) {
            if (group.length < 2) continue;
            const first = pinKey(comp.id, group[0]);
            for (let i = 1; i < group.length; i++) {
                uf.union(first, pinKey(comp.id, group[i]));
            }
        }
    }

    // Fusionar pines conectados por cables (Wire).
    for (const wire of projection.wires) {
        const k1 = pinKey(wire.from.componentId, wire.from.pinId);
        const k2 = pinKey(wire.to.componentId, wire.to.pinId);
        if (!uf.parent.has(k1)) uf.parent.set(k1, k1);
        if (!uf.parent.has(k2)) uf.parent.set(k2, k2);
        uf.union(k1, k2);
    }

    // Asignar un ID de net a cada grupo de pines equipotenciales.
    const groups = uf.groups();
    const pinToNetId = new Map<string, string>();
    const nets: Array<{ id: string; pins: PinReference[] }> = [];

    let netIndex = 0;
    for (const [, pins] of groups) {
        const netId = `net_${netIndex++}`;
        const pinRefs: PinReference[] = [];
        for (const pinStr of pins) {
            const separator = pinStr.indexOf('|');
            const componentId = pinStr.slice(0, separator);
            const pinId = pinStr.slice(separator + 1);
            pinToNetId.set(pinStr, netId);
            pinRefs.push({ componentId, pinId });
        }
        nets.push({ id: netId, pins: pinRefs });
    }

    // Construir elements: uno por elemento eléctrico declarado en el manifiesto.
    const elements: Netlist['elements'] = [];

    for (const comp of projection.components) {
        const manifest = manifestById.get(comp.type);
        if (!manifest || !manifest.elements) continue;

        for (const elem of manifest.elements) {
            const terminals: Record<string, string> = {};
            for (const [role, pinId] of Object.entries(elem.ports)) {
                const netId = pinToNetId.get(pinKey(comp.id, pinId));
                if (netId) {
                    terminals[role] = netId;
                }
            }

            const numericParams: Record<string, number> = {};
            for (const [key, value] of Object.entries(comp.params)) {
                if (typeof value === 'number') {
                    numericParams[key] = value;
                }
            }

            elements.push({
                id: `${comp.id}:${elem.id}`,
                primitive: elem.primitive,
                params: { ...elem.params, ...numericParams },
                terminals,
                componentId: comp.id,
            });
        }
    }

    return { nets, elements };
}
