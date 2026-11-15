import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { DocumentStore } from '../stores/documentStore';
import { normalizeCircuitDocument, buildShareCode } from '../services/api';
import type { CircuitDocument } from '@types';

const rawSharedCircuit = {
    formatVersion: 1,
    components: [
        { id: 'microcontroladores_5', type: 'core/esp32@1', position: { x: 80, y: 60 }, params: {} },
        { id: 'salidas_7', type: 'core/led@1', position: { x: 240, y: 300 }, params: { color: '#e74c3c' } },
    ],
    wires: [
        { id: 'wire_9', from: { componentId: 'microcontroladores_5', pinId: 'gpio2' }, to: { componentId: 'salidas_7', pinId: 'anode' }, color: '#e74c3c' },
    ],
    programs: [
        { mcuComponentId: 'microcontroladores_5', language: 'cpp-subset', languageVersion: '1.0.0', source: 'void setup() { pinMode(2, OUTPUT); }' },
    ],
    meta: { name: 'Circuito de prueba', createdAt: 1700000000000, updatedAt: 1700000000000 },
};

describe('normalizeCircuitDocument (JSON del backend -> CircuitDocument)', () => {
    it('conserva componentes, cables y programas válidos', () => {
        const doc = normalizeCircuitDocument(structuredClone(rawSharedCircuit));
        expect(doc.formatVersion).toBe(1);
        expect(doc.components).toHaveLength(2);
        expect(doc.wires).toHaveLength(1);
        expect(doc.programs).toHaveLength(1);
        expect(doc.programs[0].source).toContain('pinMode');
        expect(doc.meta.name).toBe('Circuito de prueba');
    });

    it('descarta cables que referencian componentes inexistentes', () => {
        const raw = structuredClone(rawSharedCircuit);
        raw.wires.push({
            id: 'wire_10',
            from: { componentId: 'no_existe', pinId: 'gpio2' },
            to: { componentId: 'salidas_7', pinId: 'anode' },
            color: '#000000',
        } as never);
        const doc = normalizeCircuitDocument(raw);
        expect(doc.wires).toHaveLength(1);
        expect(doc.wires[0].id).toBe('wire_9');
    });

    it('descarta programas cuyo MCU no existe en el circuito', () => {
        const raw = structuredClone(rawSharedCircuit);
        raw.programs.push({
            mcuComponentId: 'mcu_fantasma',
            language: 'cpp-subset',
            languageVersion: '1.0.0',
            source: 'void loop() {}',
        } as never);
        const doc = normalizeCircuitDocument(raw);
        expect(doc.programs).toHaveLength(1);
        expect(doc.programs[0].mcuComponentId).toBe('microcontroladores_5');
    });

    it('rellena valores por defecto cuando faltan (meta, formatVersion)', () => {
        const doc = normalizeCircuitDocument({ components: [], wires: [], programs: [] });
        expect(doc.formatVersion).toBe(1);
        expect(doc.meta.name).toBeTruthy();
    });

    it('lanza un error legible si circuitData no es un objeto', () => {
        expect(() => normalizeCircuitDocument('no-json')).toThrow();
        expect(() => normalizeCircuitDocument(null)).toThrow();
    });
});

describe('buildShareCode (campo `code` obligatorio del DTO)', () => {
    it('devuelve un texto no vacío aunque no haya programas', () => {
        const doc: CircuitDocument = {
            formatVersion: 1,
            components: [],
            wires: [],
            programs: [],
            meta: { name: 'x', createdAt: 1, updatedAt: 1 },
        };
        expect(buildShareCode(doc).length).toBeGreaterThan(0);
    });

    it('incluye un bloque con el MCU y el fuente de cada programa', () => {
        const doc = normalizeCircuitDocument(structuredClone(rawSharedCircuit));
        doc.programs.push({
            mcuComponentId: 'microcontroladores_5',
            language: 'cpp-subset',
            languageVersion: '1.0.0',
            source: 'void loop() { digitalWrite(2, LOW); }',
        });
        const code = buildShareCode(doc);
        expect(code).toContain('microcontroladores_5');
        expect(code).toContain('pinMode');
        expect(code).toContain('digitalWrite');
    });
});

describe('DocumentStore.replaceDocument (carga de enlaces compartidos)', () => {
    let store: DocumentStore;
    beforeEach(() => {
        ManifestRegistry.init();
        store = new DocumentStore();
    });

    it('reemplaza el documento completo y expone los programas en el snapshot', () => {
        store.replaceDocument(normalizeCircuitDocument(structuredClone(rawSharedCircuit)));
        const snap = store.getSnapshot();
        expect(snap.components).toHaveLength(2);
        expect(snap.programs).toHaveLength(1);
        expect(snap.meta.name).toBe('Circuito de prueba');
    });

    it('recalcula los contadores: los ids nuevos no colisionan con los cargados', () => {
        store.replaceDocument(normalizeCircuitDocument(structuredClone(rawSharedCircuit)));
        const wire = store.addWire(
            { componentId: 'microcontroladores_5', pinId: 'gpio4' },
            { componentId: 'salidas_7', pinId: 'anode' },
        );
        expect(wire?.id).toBe('wire_10');
    });

    it('marca el documento como topología nueva (fuerza LOAD_CIRCUIT en App)', () => {
        expect(store.hasTopologyChanged()).toBe(true); // primera lectura consume el hash vacío
        store.replaceDocument(normalizeCircuitDocument(structuredClone(rawSharedCircuit)));
        expect(store.hasTopologyChanged()).toBe(true);
    });
});
