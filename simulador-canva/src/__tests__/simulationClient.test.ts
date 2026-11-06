import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock de Worker antes de importar el cliente
const posted: unknown[] = [];
let messageHandler: ((e: { data: unknown }) => void) | null = null;

class MockWorker {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    constructor() {
        messageHandler = (e) => this.onmessage?.(e);
    }
    postMessage(msg: unknown) {
        posted.push(msg);
    }
    terminate() {}
}

vi.stubGlobal('Worker', MockWorker);

const { simulationClient } = await import('../worker/simulationClient');
const { simulationStore } = await import('../stores/simulationStore');
const { ManifestRegistry } = await import('../core/registry/manifestRegistry');

function emit(data: unknown) {
    messageHandler?.({ data });
}

describe('SimulationClient <-> Worker (protocolo 1.0.0)', () => {
    beforeEach(() => {
        posted.length = 0;
        ManifestRegistry.init();
    });

    it('hace handshake HELLO y aplica READY/STATUS/SNAPSHOT', () => {
        simulationClient.loadCircuit(
            { components: [], wires: [], programs: [] },
            ManifestRegistry.getAll(),
        );

        // HELLO + LOAD_CIRCUIT
        expect(posted.map((m) => (m as { type: string }).type)).toEqual(['HELLO', 'LOAD_CIRCUIT']);

        emit({ type: 'READY', payload: { version: '1.0.0', catalogVersion: '1.0.0' } });
        expect(simulationStore.getSnapshot().status).toBe('idle');

        emit({ type: 'STATUS', payload: { state: 'running', virtualTimeUs: 1000 } });
        expect(simulationStore.getSnapshot().status).toBe('running');
        expect(simulationStore.getSnapshot().virtualTimeUs).toBe(1000);

        emit({
            type: 'SNAPSHOT',
            payload: {
                seq: 1,
                virtualTimeUs: 1000,
                type: 'full',
                changes: { 'led1:d1': { voltage: 3.3, current: 0.15, power: 0.495, conducting: true } },
            },
        });
        const snap = simulationStore.getSnapshot();
        expect(snap.lastSeq).toBe(1);
        expect(snap.states['led1:d1']).toMatchObject({ voltage: 3.3, conducting: true });

        // ACK_SNAPSHOT automático
        const last = posted[posted.length - 1] as { type: string; payload: { seq: number } };
        expect(last.type).toBe('ACK_SNAPSHOT');
        expect(last.payload.seq).toBe(1);

        // Log no vacío (visible en panel y consola)
        expect(snap.log.length).toBeGreaterThan(0);
    });

    it('aplica SOLVER_RESULT vía EVENT sin romper el protocolo', () => {
        emit({
            type: 'EVENT',
            payload: {
                virtualTimeUs: 0,
                eventType: 'SOLVER_RESULT',
                sourceId: 'solver',
                data: { converged: true, diagnostics: [], iterations: 2, nodeVoltages: { net_0: 3.3 } },
            },
        });
        const snap = simulationStore.getSnapshot();
        expect(snap.converged).toBe(true);
        expect(snap.iterations).toBe(2);
    });

    it('CONTROL START/PAUSE/RESET/STEP se postean al worker', () => {
        simulationClient.control('START');
        simulationClient.control('PAUSE');
        simulationClient.control('RESET');
        simulationClient.control('STEP', 1000);
        const types = posted.slice(-4).map((m) => (m as { type: string }).type);
        expect(types).toEqual(['CONTROL', 'CONTROL', 'CONTROL', 'CONTROL']);
    });
});
