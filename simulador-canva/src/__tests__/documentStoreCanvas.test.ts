import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { DocumentStore } from '../stores/documentStore';

describe('DocumentStore: altas/bajas y validación de cables (canvas)', () => {
    let store: DocumentStore;
    beforeEach(() => {
        ManifestRegistry.init();
        store = new DocumentStore();
    });

    it('addComponent devuelve la instancia y usa params por defecto del manifiesto', () => {
        const led = store.addComponent('core/led@1', { x: 10, y: 20 });
        expect(led.id).toBeTruthy();
        expect(led.position).toEqual({ x: 10, y: 20 });
        expect(led.params.color).toBe('#e74c3c'); // default del manifiesto
        expect(store.getComponent(led.id)).toBe(led);
    });

    it('los ids son únicos aunque se añadan varios rápido', () => {
        const a = store.addComponent('core/led@1', { x: 0, y: 0 });
        const b = store.addComponent('core/led@1', { x: 0, y: 0 });
        expect(a.id).not.toBe(b.id);
    });

    it('addWire valida: pines existentes, no mismo pin, sin duplicados', () => {
        const led = store.addComponent('core/led@1', { x: 0, y: 0 });
        const bb = store.addComponent('core/breadboard@1', { x: 100, y: 0 });

        expect(store.addWire(
            { componentId: led.id, pinId: 'anode' },
            { componentId: bb.id, pinId: 'a1' },
        )).toBeDefined();

        // Duplicado invertido → rechazado
        expect(store.addWire(
            { componentId: bb.id, pinId: 'a1' },
            { componentId: led.id, pinId: 'anode' },
        )).toBeUndefined();

        // Mismo pin consigo mismo → rechazado
        expect(store.addWire(
            { componentId: led.id, pinId: 'anode' },
            { componentId: led.id, pinId: 'anode' },
        )).toBeUndefined();

        // Pin inexistente → rechazado
        expect(store.addWire(
            { componentId: led.id, pinId: 'nope' },
            { componentId: bb.id, pinId: 'a1' },
        )).toBeUndefined();

        // Mismo pin con varios cables hacia destinos distintos → permitido
        expect(store.addWire(
            { componentId: led.id, pinId: 'cathode' },
            { componentId: bb.id, pinId: 'a1' },
        )).toBeDefined();
    });

    it('removeComponent elimina en cascada sus cables', () => {
        const led = store.addComponent('core/led@1', { x: 0, y: 0 });
        const bb = store.addComponent('core/breadboard@1', { x: 100, y: 0 });
        const wire = store.addWire(
            { componentId: led.id, pinId: 'anode' },
            { componentId: bb.id, pinId: 'a1' },
        )!;
        expect(store.getDocument().wires.length).toBe(1);

        store.removeComponent(led.id);
        expect(store.getDocument().components.length).toBe(1);
        expect(store.getWire(wire.id)).toBeUndefined();
    });

    it('removeComponent también elimina el programa del MCU (no queda huérfano en el documento)', () => {
        const esp = store.addComponent('core/esp32@1', { x: 0, y: 0 });
        const bb = store.addComponent('core/breadboard@1', { x: 100, y: 0 });
        store.setProgram(esp.id, 'void setup() {} void loop() {}');
        expect(store.getDocument().programs).toHaveLength(1);

        store.removeComponent(esp.id);
        expect(store.getDocument().programs).toHaveLength(0);
        expect(store.getSimulationProjection().programs).toHaveLength(0);
        expect(store.getDocument().components.map((c) => c.id)).toEqual([bb.id]);
    });

    it('removeWire borra solo el cable indicado', () => {
        const led = store.addComponent('core/led@1', { x: 0, y: 0 });
        const bb = store.addComponent('core/breadboard@1', { x: 100, y: 0 });
        const w1 = store.addWire({ componentId: led.id, pinId: 'anode' }, { componentId: bb.id, pinId: 'a1' })!;
        store.addWire({ componentId: led.id, pinId: 'cathode' }, { componentId: bb.id, pinId: 'b1' });

        store.removeWire(w1.id);
        expect(store.getDocument().wires.length).toBe(1);
    });

    it('setProgram guarda el sketch en el documento y en la proyección para el worker', () => {
        const esp = store.addComponent('core/esp32@1', { x: 0, y: 0 });
        const before = store.getSnapshot();

        store.setProgram(esp.id, 'void setup() {} void loop() {}');

        // La proyección (que es lo que viaja al worker) incluye el programa:
        // así el sketch sobrevive a los LOAD_CIRCUIT por cambios de topología.
        const proj = store.getSimulationProjection();
        expect(proj.programs).toHaveLength(1);
        expect(proj.programs[0]).toMatchObject({
            mcuComponentId: esp.id,
            language: 'cpp-subset',
            source: 'void setup() {} void loop() {}',
        });

        // React debe ver una referencia nueva para re-renderizar
        expect(store.getSnapshot()).not.toBe(before);
        expect(store.getSnapshot().programs).toHaveLength(1);

        // Recargar el mismo MCU reemplaza el sketch (no acumula duplicados)
        store.setProgram(esp.id, 'void setup() { pinMode(2, 1); } void loop() {}');
        expect(store.getSimulationProjection().programs).toHaveLength(1);
        expect(store.getDocument().programs[0].source).toContain('pinMode');
    });

    it('la proyección de simulación excluye tipos sin manifiesto', () => {
        const led = store.addComponent('core/led@1', { x: 0, y: 0 });
        // inyectar un tipo desconocido directamente en el documento
        store.getDocument().components.push({
            id: 'x1', type: 'community/desconocido@1', position: { x: 0, y: 0 }, params: {},
        });
        const proj = store.getSimulationProjection();
        expect(proj.components.map((c) => c.id)).toEqual([led.id]);
    });

    // -------------------------------------------------------------------------
    // Regresión: React solo re-renderiza si la referencia del snapshot cambia
    // -------------------------------------------------------------------------
    it('getSnapshot devuelve una referencia NUEVA tras cada cambio (mover, cablear)', () => {
        const led = store.addComponent('core/led@1', { x: 0, y: 0 });
        const bb = store.addComponent('core/breadboard@1', { x: 100, y: 0 });

        const beforeMove = store.getSnapshot();
        store.updateComponentPosition(led.id, 350, 420);
        const afterMove = store.getSnapshot();
        expect(afterMove).not.toBe(beforeMove);

        // La posición nueva es visible en el snapshot (cable debe seguirla)
        expect(afterMove.components.find((c) => c.id === led.id)?.position).toEqual({ x: 350, y: 420 });

        const beforeWire = store.getSnapshot();
        store.addWire({ componentId: led.id, pinId: 'anode' }, { componentId: bb.id, pinId: 'a1' });
        const afterWire = store.getSnapshot();
        expect(afterWire).not.toBe(beforeWire);
        expect(afterWire.wires.length).toBe(1);
    });

    it('getSnapshot devuelve la MISMA referencia si no hubo cambios (evita bucles de render)', () => {
        store.addComponent('core/led@1', { x: 0, y: 0 });
        expect(store.getSnapshot()).toBe(store.getSnapshot());

        // Una operación que no valida (cable repetido) tampoco debe emitir cambio
        const a = store.addComponent('core/led@1', { x: 0, y: 0 });
        const b = store.addComponent('core/led@1', { x: 0, y: 0 });
        store.addWire({ componentId: a.id, pinId: 'anode' }, { componentId: b.id, pinId: 'cathode' });
        const before = store.getSnapshot();
        store.addWire({ componentId: b.id, pinId: 'cathode' }, { componentId: a.id, pinId: 'anode' });
        expect(store.getSnapshot()).toBe(before);
    });

    it('los suscriptores son notificados al cambiar (React se re-renderiza)', () => {
        let notified = 0;
        const unsub = store.subscribe(() => notified++);
        const led = store.addComponent('core/led@1', { x: 0, y: 0 });
        store.updateComponentPosition(led.id, 10, 10);
        expect(notified).toBe(2);
        unsub();
        store.updateComponentPosition(led.id, 20, 20);
        expect(notified).toBe(2);
    });
});
