import type { ComponentManifest } from '@types';
import { LedManifest, BreadboardManifest, Esp32Manifest } from '../manifests';

export class ManifestRegistry {
    private static catalog = new Map<string, ComponentManifest>();

    public static init() {
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

    public static validate(manifest: ComponentManifest) {
        if (!manifest.id || !manifest.version) {
            throw new Error(`[ManifestRegistry] El manifiesto carece de ID o versión.`);
        }

        // Validar IDs de pines únicos
        const pinIds = new Set<string>();
        for (const pin of manifest.pins) {
            if (pinIds.has(pin.id)) {
                throw new Error(`[ManifestRegistry] Pin duplicado '${pin.id}' en '${manifest.id}'.`);
            }
            pinIds.add(pin.id);
        }

        // Validar que las conexiones internas apunten a pines existentes
        if (manifest.internalGroups) {
            for (const group of manifest.internalGroups) {
                for (const pinId of group) {
                    if (!pinIds.has(pinId)) {
                        throw new Error(`[ManifestRegistry] Conexión interna apunta a pin inexistente '${pinId}' en '${manifest.id}'.`);
                    }
                }
            }
        }
    }
}

// Inicializar catálogo base
ManifestRegistry.init();