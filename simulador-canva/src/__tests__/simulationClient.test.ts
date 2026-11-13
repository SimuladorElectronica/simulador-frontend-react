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
const { mqttStore } = await import('../stores/mqttStore');
const { mqttProxy } = await import('../services/mqttProxy');
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

    it('MQTT_PUBLISH alimenta el monitor MQTT, se reenvía al broker y queda en el log', () => {
        mqttStore.clearMessages();
        // Sin broker conectado: publish devuelve false pero el eco local persiste
        const publishSpy = vi.spyOn(mqttProxy, 'publish').mockReturnValue(false);

        emit({
            type: 'EVENT',
            payload: {
                virtualTimeUs: 42_000,
                eventType: 'MQTT_PUBLISH',
                sourceId: 'mcu1',
                data: {
                    library: 'PubSubClient',
                    objectName: 'client',
                    topic: 'esp32/led',
                    payload: 'ON',
                },
            },
        });

        // 1. El monitor recibe el mensaje con tiempo virtual y origen "sketch"
        const messages = mqttStore.getState().messages;
        const last = messages[messages.length - 1];
        expect(last).toMatchObject({
            topic: 'esp32/led',
            payload: 'ON',
            virtualTimeUs: 42_000,
            source: 'sketch',
        });

        // 2. Se reenvía al broker simulado
        expect(publishSpy).toHaveBeenCalledWith('esp32/led', 'ON');

        // 3. El log del panel muestra una línea compacta (no un JSON crudo)
        const log = simulationStore.getSnapshot().log.map((l) => l.text).join('\n');
        expect(log).toContain('MQTT PUBLISH esp32/led: ON');

        publishSpy.mockRestore();
    });

    it('MQTT_SUBSCRIBE/MQTT_UNSUBSCRIBE suscriben y desuscriben vía el proxy y el store', () => {
        mqttStore.reset();
        const subscribeSpy = vi.spyOn(mqttProxy, 'subscribeTopic');
        const unsubscribeSpy = vi.spyOn(mqttProxy, 'unsubscribeTopic');

        emit({
            type: 'EVENT',
            payload: {
                virtualTimeUs: 1_000,
                eventType: 'MQTT_SUBSCRIBE',
                sourceId: 'mcu1',
                data: { library: 'PubSubClient', objectName: 'client', topic: 'esp32/led' },
            },
        });

        expect(subscribeSpy).toHaveBeenCalledWith('esp32/led');
        // subscribeTopic real: registra el tópico en el store (chip del monitor)
        expect(mqttStore.getState().subscriptions).toContain('esp32/led');

        emit({
            type: 'EVENT',
            payload: {
                virtualTimeUs: 2_000,
                eventType: 'MQTT_UNSUBSCRIBE',
                sourceId: 'mcu1',
                data: { library: 'PubSubClient', objectName: 'client', topic: 'esp32/led' },
            },
        });

        expect(unsubscribeSpy).toHaveBeenCalledWith('esp32/led');
        expect(mqttStore.getState().subscriptions).not.toContain('esp32/led');

        // Log compacto, no JSON crudo
        const log = simulationStore.getSnapshot().log.map((l) => l.text).join('\n');
        expect(log).toContain('MQTT SUBSCRIBE esp32/led');
        expect(log).toContain('MQTT UNSUBSCRIBE esp32/led');

        subscribeSpy.mockRestore();
        unsubscribeSpy.mockRestore();
        mqttStore.reset();
    });

    it('un mensaje del broker (proxy.onMessage) se postea al worker como MQTT_MESSAGE', () => {
        // El constructor del cliente registra el hook en el proxy (singleton).
        expect(mqttProxy.onMessage).toBeTypeOf('function');

        const before = posted.length;
        mqttProxy.onMessage?.('esp32/led', 'HOLA');

        const mqttMessages = posted.slice(before).filter(
            (m) => (m as { type: string }).type === 'MQTT_MESSAGE',
        ) as Array<{ payload: { topic: string; payload: string } }>;
        expect(mqttMessages).toHaveLength(1);
        expect(mqttMessages[0].payload).toEqual({ topic: 'esp32/led', payload: 'HOLA' });
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
