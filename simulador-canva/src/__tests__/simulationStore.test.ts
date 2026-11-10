import { describe, it, expect } from 'vitest';
import { SimulationStore } from '../stores/simulationStore';

describe('SimulationStore: monitor serie', () => {
    it('SERIAL_RESET limpia el monitor y la salida posterior vuelve a llenarlo', () => {
        const store = new SimulationStore();

        store.applyEvent('SERIAL', 'esp', '111');
        store.applyEvent('SERIAL', 'esp', '222');
        expect(store.getSnapshot().serial.map((e) => e.text)).toEqual(['111', '222']);

        store.applyEvent('SERIAL_RESET', 'system', null);
        expect(store.getSnapshot().serial).toEqual([]);

        store.applyEvent('SERIAL', 'esp', '1');
        expect(store.getSnapshot().serial.map((e) => e.text)).toEqual(['1']);
    });

    it('clearSerial vacía el monitor serie (botón Limpiar de la consola UART)', () => {
        const store = new SimulationStore();
        store.applyEvent('SERIAL', 'esp', 'linea');
        expect(store.getSnapshot().serial).toHaveLength(1);
        store.clearSerial();
        expect(store.getSnapshot().serial).toEqual([]);
    });

    it('un snapshot "full" reemplaza los estados: desaparecen los elementos del componente eliminado', () => {
        const store = new SimulationStore();

        store.applySnapshot(0, { 'esp:vcc_3v3': { voltage: 3.3 }, 'led1:d1': { voltage: 2.1 } }, 1, 'full');
        expect(Object.keys(store.getSnapshot().states).sort()).toEqual(['esp:vcc_3v3', 'led1:d1']);

        // El LED se eliminó del circuito: el worker recarga y manda un "full"
        // sin led1:d1; la fila fantasma debe desaparecer del panel.
        store.applySnapshot(0, { 'esp:vcc_3v3': { voltage: 3.3 } }, 1, 'full');
        expect(Object.keys(store.getSnapshot().states)).toEqual(['esp:vcc_3v3']);
    });

    it('un snapshot "delta" fusiona sobre los estados existentes', () => {
        const store = new SimulationStore();

        store.applySnapshot(0, { 'esp:vcc_3v3': { voltage: 3.3 }, 'led1:d1': { voltage: 2.1 } }, 1, 'full');
        store.applySnapshot(10, { 'led1:d1': { voltage: 0 } }, 2, 'delta');
        expect(store.getSnapshot().states['led1:d1']).toMatchObject({ voltage: 0 });
        expect(store.getSnapshot().states['esp:vcc_3v3']).toMatchObject({ voltage: 3.3 });
    });
});
