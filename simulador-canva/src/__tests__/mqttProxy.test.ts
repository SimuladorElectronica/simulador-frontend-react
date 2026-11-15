import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Mock de WebSocket (jsdom no conecta a un broker real).
 * Cada instancia queda registrada en `instances` para inspeccionarla.
 */
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

class MockWebSocket {
    static instances: MockWebSocket[] = [];

    readonly state = {
        url: '',
        readyState: WS_CONNECTING,
        sent: [] as string[],
        onopen: null as ((event: unknown) => void) | null,
        onmessage: null as ((event: { data: unknown }) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
        onclose: null as ((event: unknown) => void) | null,
    };

    get readyState() {
        return this.state.readyState;
    }

    get onopen() {
        return this.state.onopen;
    }

    set onopen(handler: ((event: unknown) => void) | null) {
        this.state.onopen = handler;
    }

    get onmessage() {
        return this.state.onmessage;
    }

    set onmessage(handler: ((event: { data: unknown }) => void) | null) {
        this.state.onmessage = handler;
    }

    get onerror() {
        return this.state.onerror;
    }

    set onerror(handler: ((event: unknown) => void) | null) {
        this.state.onerror = handler;
    }

    get onclose() {
        return this.state.onclose;
    }

    set onclose(handler: ((event: unknown) => void) | null) {
        this.state.onclose = handler;
    }

    constructor(url: string) {
        this.state.url = url;
        MockWebSocket.instances.push(this);
    }

    send(data: unknown) {
        this.state.sent.push(String(data));
    }

    close() {
        this.state.readyState = WS_CLOSED;
        this.onclose?.({});
    }

    /** Simula el handshake completado por el broker. */
    simulateOpen() {
        this.state.readyState = WS_OPEN;
        this.onopen?.({});
    }

    /** Simula un frame entrante del broker. */
    simulateMessage(data: unknown) {
        this.onmessage?.({ data });
    }

    /** Simula que el broker cortó la conexión. */
    simulateBrokerClose() {
        this.state.readyState = WS_CLOSED;
        this.onclose?.({});
    }
}

Object.assign(MockWebSocket, {
    CONNECTING: WS_CONNECTING,
    OPEN: WS_OPEN,
    CLOSED: WS_CLOSED,
});

vi.stubGlobal('WebSocket', MockWebSocket);

const { mqttProxy, resolveMqttWsUrl } = await import('../services/mqttProxy');
const { mqttStore } = await import('../stores/mqttStore');

const sentJson = (ws: MockWebSocket) => ws.state.sent.map((raw) => JSON.parse(raw));

describe('mqttProxy (broker simulado backend-iot-fastapi)', () => {
    beforeEach(() => {
        MockWebSocket.instances = [];
        mqttProxy.resetForTests();
        mqttStore.reset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('apunta por defecto a ws://localhost:8000/ws/simulador-frontend', () => {
        expect(resolveMqttWsUrl()).toBe('ws://localhost:8000/ws/simulador-frontend');
    });

    it('connect abre el socket y marca "connecting"; onopen marca "connected"', () => {
        mqttProxy.connect();
        expect(MockWebSocket.instances).toHaveLength(1);
        expect(MockWebSocket.instances[0].state.url).toBe('ws://localhost:8000/ws/simulador-frontend');
        expect(mqttStore.getState().connection).toBe('connecting');

        MockWebSocket.instances[0].simulateOpen();
        expect(mqttStore.getState().connection).toBe('connected');
    });

    it('connect es idempotente (no abre dos sockets)', () => {
        mqttProxy.connect();
        mqttProxy.connect();
        expect(MockWebSocket.instances).toHaveLength(1);
    });

    it('al abrir reenvía las suscripciones pendientes (hechas sin conexión)', () => {
        mqttProxy.subscribeTopic('esp32/led'); // sin conexión: solo queda en el store
        expect(mqttStore.getState().subscriptions).toEqual(['esp32/led']);

        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();
        expect(sentJson(ws)).toContainEqual({ action: 'subscribe', topic: 'esp32/led' });
    });

    it('publish envía {action:"publish"} cuando está conectado', () => {
        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();

        const sent = mqttProxy.publish('esp32/led', 'ON');
        expect(sent).toBe(true);
        expect(sentJson(ws)).toContainEqual({ action: 'publish', topic: 'esp32/led', payload: 'ON' });
    });

    it('publish desconectado devuelve false y no envía nada', () => {
        expect(mqttProxy.publish('esp32/led', 'ON')).toBe(false);
        mqttProxy.connect(); // sigue CONNECTING: todavía no se puede enviar
        expect(mqttProxy.publish('esp32/led', 'ON')).toBe(false);
    });

    it('los mensajes mqtt_message del broker llegan al store (con epoch→ms)', () => {
        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();

        ws.simulateMessage(
            JSON.stringify({
                type: 'mqtt_message',
                topic: 'esp32/led',
                payload: 'ON',
                timestamp: 1_700_000_000,
            }),
        );

        const messages = mqttStore.getState().messages;
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({
            source: 'broker',
            topic: 'esp32/led',
            payload: 'ON',
            timestamp: 1_700_000_000_000,
        });
    });

    it('ignora acks {type:"system"} y frames que no son JSON', () => {
        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();

        ws.simulateMessage(JSON.stringify({ type: 'system', status: 'subscribed', topic: 'esp32/led' }));
        ws.simulateMessage('{{{ no json');
        ws.simulateMessage(JSON.stringify({ error: 'Acción desconocida' }));

        expect(mqttStore.getState().messages).toHaveLength(0);
    });

    it('onMessage recibe los mqtt_message (no acks ni frames inválidos)', () => {
        const received: Array<{ topic: string; payload: string }> = [];
        mqttProxy.onMessage = (topic, payload) => received.push({ topic, payload });

        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();

        ws.simulateMessage(JSON.stringify({ type: 'system', status: 'subscribed', topic: 'esp32/led' }));
        ws.simulateMessage('{{{ no json');
        ws.simulateMessage(
            JSON.stringify({ type: 'mqtt_message', topic: 'esp32/led', payload: 'ON', timestamp: 1 }),
        );

        expect(received).toEqual([{ topic: 'esp32/led', payload: 'ON' }]);
        expect(mqttStore.getState().messages).toHaveLength(1);
    });

    it('un onMessage que lanza no rompe el registro del mensaje', () => {
        mqttProxy.onMessage = () => {
            throw new Error('boom');
        };

        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();
        ws.simulateMessage(
            JSON.stringify({ type: 'mqtt_message', topic: 'esp32/led', payload: 'ON' }),
        );

        // El mensaje queda registrado en el monitor aunque el listener falle
        expect(mqttStore.getState().messages).toHaveLength(1);
    });

    it('resetForTests limpia el onMessage registrado', () => {
        mqttProxy.onMessage = () => {};
        mqttProxy.resetForTests();
        expect(mqttProxy.onMessage).toBeNull();
    });

    it('subscribeTopic/unsubscribeTopic sincronizan el store y el broker', () => {
        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();

        mqttProxy.subscribeTopic('  esp32/led  '); // se normaliza con trim
        mqttProxy.subscribeTopic(''); // vacío: ignorado
        expect(mqttStore.getState().subscriptions).toEqual(['esp32/led']);
        expect(sentJson(ws)).toContainEqual({ action: 'subscribe', topic: 'esp32/led' });

        mqttProxy.unsubscribeTopic('esp32/led');
        expect(mqttStore.getState().subscriptions).toEqual([]);
        expect(sentJson(ws)).toContainEqual({ action: 'unsubscribe', topic: 'esp32/led' });
    });

    it('disconnect() corta, marca desconectado y NO reconecta', () => {
        vi.useFakeTimers();
        mqttProxy.connect();
        const ws = MockWebSocket.instances[0];
        ws.simulateOpen();

        mqttProxy.disconnect();
        expect(mqttStore.getState().connection).toBe('disconnected');

        vi.advanceTimersByTime(60_000);
        expect(MockWebSocket.instances).toHaveLength(1); // sin reintentos
    });

    it('si el broker corta, reconecta con backoff (hasta 5 intentos)', () => {
        vi.useFakeTimers();
        mqttProxy.connect();
        const first = MockWebSocket.instances[0];
        first.simulateOpen();

        first.simulateBrokerClose();
        expect(mqttStore.getState().connection).toBe('disconnected');

        vi.advanceTimersByTime(1000); // primer intento: 1s
        expect(MockWebSocket.instances).toHaveLength(2);

        // El broker vuelve a cortar cada intento; se agota el máximo (5)
        for (let i = 0; i < 4; i++) {
            const next = MockWebSocket.instances[MockWebSocket.instances.length - 1];
            next.simulateBrokerClose();
            vi.advanceTimersByTime(60_000);
        }
        expect(MockWebSocket.instances.length).toBeLessThanOrEqual(1 + 5);
        const count = MockWebSocket.instances.length;
        vi.advanceTimersByTime(120_000);
        expect(MockWebSocket.instances.length).toBe(count); // no sigue reintentando
    });
});
