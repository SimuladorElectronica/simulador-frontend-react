// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { startFreshCircuit } from '../services/freshCircuit';
import { documentStore } from '../stores/documentStore';
import { projectStore } from '../stores/projectStore';

describe('startFreshCircuit (arranque en blanco del simulador)', () => {
    beforeEach(() => {
        // Simular un "último proyecto recordado" + un lienzo con trabajo
        documentStore.replaceDocument({
            formatVersion: 1,
            components: [
                { id: 'microcontroladores_1', type: 'core/esp32@1', position: { x: 10, y: 10 }, params: {} },
            ],
            wires: [],
            programs: [
                { mcuComponentId: 'microcontroladores_1', language: 'cpp-subset', languageVersion: '1.0.0', source: 'void setup() {}' },
            ],
            meta: { name: 'Proyecto Anterior', createdAt: Date.now(), updatedAt: Date.now() },
        });
        projectStore.set({ id: 'uuid-prev', shareSlug: 'prev12' });
    });

    it('vacía el lienzo y establece un documento en blanco con nombre nuevo', () => {
        startFreshCircuit();
        const doc = documentStore.getSnapshot();
        expect(doc.components).toHaveLength(0);
        expect(doc.wires).toHaveLength(0);
        expect(doc.programs).toHaveLength(0);
        expect(doc.meta.name).toBe('Proyecto Sin Título');
    });

    it('olvida el proyecto recordado (el próximo guardado crea uno NUEVO)', () => {
        startFreshCircuit();
        expect(projectStore.get()).toBeNull();
        expect(localStorage.getItem('simulador.project')).toBeNull();
    });
});
