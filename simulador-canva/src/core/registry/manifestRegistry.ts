import type { ComponentManifest } from '@types';
import { LedManifest, BreadboardManifest, Esp32Manifest } from '../manifests';

export class ManifestRegistry {
    private static catalog = new Map<string, ComponentManifest>();

    public static init() {
        this.catalog.clear();
        this.register(LedManifest);
        this.register(BreadboardManifest);
        this.register(Esp32Manifest);
    }

    public static register(manifest: ComponentManifest) {
        this.validate(manifest);
        this.catalog.set(manifest.id, manifest);
    }

    public static get(id: string): ComponentManifest | undefined {
        return this.catalog.get(id);
    }

    public static getAll(): ComponentManifest[] {
        return Array.from(this.catalog.values());
    }

    public static validate(manifest: ComponentManifest) {
        if (!manifest.id || !manifest.version) {
            throw new Error(`[ManifestRegistry] El manifiesto carece de ID o versión.`);
        }

        // 1. Unicidad de IDs de pines
        const pinIds = new Set<string>();
        for (const pin of manifest.pins) {
            if (pinIds.has(pin.id)) {
                throw new Error(`[ManifestRegistry] Pin duplicado '${pin.id}' en manifiesto '${manifest.id}'.`);
            }
            pinIds.add(pin.id);
        }

        // 2. Validación de Conexiones Internas (internalGroups)
        if (manifest.internalGroups) {
            for (const group of manifest.internalGroups) {
                for (const pinId of group) {
                    if (!pinIds.has(pinId)) {
                        throw new Error(`[ManifestRegistry] Grupo interno referencia pin inexistente '${pinId}' en '${manifest.id}'.`);
                    }
                }
            }
        }

        // 3. Validación de Elementos Eléctricos y sus Puertos
        const elementIds = new Set<string>();
        if (manifest.elements) {
            for (const elem of manifest.elements) {
                if (elementIds.has(elem.id)) {
                    throw new Error(`[ManifestRegistry] Elemento duplicado '${elem.id}' en '${manifest.id}'.`);
                }
                elementIds.add(elem.id);

                // Validar que cada puerto mapeado apunte a un pin existente
                for (const [portRole, pinId] of Object.entries(elem.ports)) {
                    if (!pinIds.has(pinId)) {
                        throw new Error(`[ManifestRegistry] Puerto '${portRole}' del elemento '${elem.id}' apunta a pin inexistente '${pinId}'.`);
                    }
                }
            }
        }

        // 4. Validación de Monitores de Daño / Reset
        if (manifest.monitors) {
            for (const mon of manifest.monitors) {
                if (!elementIds.has(mon.element)) {
                    throw new Error(`[ManifestRegistry] Monitor referencia un elemento inexistente '${mon.element}' en '${manifest.id}'.`);
                }
                if (mon.action === 'reset' && !manifest.mcu) {
                    throw new Error(`[ManifestRegistry] Acción 'reset' en monitor solo está permitida en componentes con MCU ('${manifest.id}').`);
                }
            }
        }
    }
}

// Inicialización automática
ManifestRegistry.init();