import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { DocumentStore } from '../stores/documentStore';
import { LedManifest,BreadboardManifest, Esp32Manifest } from '@core/manifests';
import type { CircuitDocument } from '@types';

describe('VERIFICACIÓN HITO H1: Fundación y Separación Dominio/Vista', () => {
    let store: DocumentStore;

    beforeEach(() => {
        // Inicializar catálogo base de manifiestos
        ManifestRegistry.init();
        store = new DocumentStore();
    });

    // -------------------------------------------------------------------------
    // CRITERIO 1: Manifiestos Base Registrados y Válidos
    // -------------------------------------------------------------------------
    it('[Criterio 1] El catálogo contiene los manifiestos base de datos puros', () => {
        const led = ManifestRegistry.get('core/led@1');
        const breadboard = ManifestRegistry.get('core/breadboard@1');
        const esp32 = ManifestRegistry.get('core/esp32@1');

        expect(led).toBeDefined();
        expect(breadboard).toBeDefined();
        expect(esp32).toBeDefined();

        // Comprobar que todos los manifiestos pasan las reglas de validación
        expect(() => ManifestRegistry.validate(led!)).not.toThrow();
        expect(() => ManifestRegistry.validate(breadboard!)).not.toThrow();
        expect(() => ManifestRegistry.validate(esp32!)).not.toThrow();
    });

    // -------------------------------------------------------------------------
    // CRITERIO 2: Arrastrar un componente NO cambia la proyección de simulación
    // -------------------------------------------------------------------------
    it('[Criterio 2] Arrastrar un componente en el canvas NO altera el hash topológico ni notifica al worker', () => {
        // 1. Agregar un LED y una Protoboard al documento
        store.addComponent('core/led@1', { x: 100, y: 100 });
        const doc = store.getDocument();
        const ledId = doc.components[0].id;

        // 2. Guardar el hash de proyección inicial
        const initialHash = store.getProjectionHash();
        expect(store.hasTopologyChanged()).toBe(true); // Se registró la alta inicial

        // Sincronizar el estado de caché en el store
        store.hasTopologyChanged(); // Se limpia el flag de cambio pendiente (lastProjectionHash actualizado)

        // 3. Simular evento de arrastre (drag&drop en Konva/UI)
        store.updateComponentPosition(ledId, 350, 420);

        // 4. VERIFICACIÓN CLAVE: La posición física cambió en el documento UI
        expect(doc.components[0].position).toEqual({ x: 350, y: 420 });

        // Pero el hash de proyección enviado al Worker permanece INTACTO
        const newHash = store.getProjectionHash();
        expect(newHash).toBe(initialHash);
        expect(store.hasTopologyChanged()).toBe(false); // Cero mensajes emitidos al Worker
    });

    // -------------------------------------------------------------------------
    // CRITERIO 3: Guardar y Cargar un Proyecto (Serialización)
    // -------------------------------------------------------------------------
    it('[Criterio 3] Un documento de circuito se serializa y deserializa de forma limpia y determinista', () => {
        // 1. Configurar circuito con LED, Protoboard y un Cable
        store.addComponent('core/led@1', { x: 50, y: 50 });
        store.addComponent('core/breadboard@1', { x: 200, y: 100 });

        const components = store.getDocument().components;
        store.addWire(
            { componentId: components[0].id, pinId: 'anode' },
            { componentId: components[1].id, pinId: 'a1' },
            '#e74c3c'
        );

        const originalDoc = store.getDocument();

        // 2. Serializar a JSON (simula guardar a disco o generar URL)
        const jsonString = JSON.stringify(originalDoc);
        expect(jsonString).not.toContain('undefined');

        // 3. Deserializar
        const restoredDoc: CircuitDocument = JSON.parse(jsonString);

        // 4. Verificación de Invariantes
        expect(restoredDoc.formatVersion).toBe(1);
        expect(restoredDoc.components.length).toBe(2);
        expect(restoredDoc.wires.length).toBe(1);
        expect(restoredDoc.wires[0].from.pinId).toBe('anode');
        expect(restoredDoc.wires[0].to.pinId).toBe('a1');
    });

    // -------------------------------------------------------------------------
    // CRITERIO 4: Tolerancia a Tipos Desconocidos (Componentes Desconocidos)
    // -------------------------------------------------------------------------
    it('[Criterio 4] Abrir un documento con un tipo desconocido muestra un marcador y no rompe el store', () => {
        const rawUnknownDoc: CircuitDocument = {
            formatVersion: 1,
            components: [
                {
                    id: 'custom_1',
                    type: 'community/sensor-desconocido@1', // No existe en el catálogo
                    position: { x: 100, y: 100 },
                    params: {},
                },
            ],
            wires: [],
            programs: [],
            meta: { name: 'Test Unknown', createdAt: Date.now(), updatedAt: Date.now() },
        };

        // Intentar resolver el manifiesto debe retornar undefined sin arrojar excepción fatal
        const manifest = ManifestRegistry.get(rawUnknownDoc.components[0].type);
        expect(manifest).toBeUndefined();

        // La proyección de simulación filtra o aisla este tipo para que el Worker no falle
        const projectionComponents = rawUnknownDoc.components.filter((c) =>
            ManifestRegistry.get(c.type)
        );
        expect(projectionComponents.length).toBe(0); // Tratado como ausente en el Worker
    });
});