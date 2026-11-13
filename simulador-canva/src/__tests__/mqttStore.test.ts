import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MqttStore } from '../stores/mqttStore';

describe('MqttStore', () => {
    let store: MqttStore;

    beforeEach(() => {
        store = new MqttStore();
    });

    it('recordLocalPublish guarda el mensaje TX con tiempo virtual', () => {
        store.recordLocalPublish('esp32/led', 'ON', 12_345);
        const messages = store.getState().messages;
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({
            topic: 'esp32/led',
            payload: 'ON',
            virtualTimeUs: 12_345,
            source: 'sketch',
        });
    });

    it('recordBrokerMessage convierte epoch segundos (time.time del backend) a ms', () => {
        store.recordBrokerMessage('esp32/led', 'OFF', 1_700_000_000);
        expect(store.getState().messages[0]).toMatchObject({
            source: 'broker',
            timestamp: 1_700_000_000_000,
        });
    });

    it('recordBrokerMessage sin timestamp válido usa la hora local', () => {
        const before = Date.now();
        store.recordBrokerMessage('a/b', 'x', Number.NaN);
        expect(store.getState().messages[0].timestamp).toBeGreaterThanOrEqual(before);
    });

    it('el buffer se acota a 100 mensajes (conserva los más recientes)', () => {
        for (let i = 0; i < 150; i++) {
            store.recordLocalPublish('t', `m${i}`);
        }
        const messages = store.getState().messages;
        expect(messages).toHaveLength(100);
        expect(messages[0].payload).toBe('m50');
        expect(messages[messages.length - 1].payload).toBe('m149');
    });

    it('los ids son correlativos aunque se limpie el buffer', () => {
        store.recordLocalPublish('t', 'a');
        store.clearMessages();
        store.recordLocalPublish('t', 'b');
        expect(store.getState().messages[0].id).toBe(2);
    });

    it('clearMessages vacía los mensajes pero conserva las suscripciones', () => {
        store.addSubscription('esp32/#');
        store.recordLocalPublish('esp32/led', 'ON');
        store.clearMessages();
        expect(store.getState().messages).toHaveLength(0);
        expect(store.getState().subscriptions).toEqual(['esp32/#']);
    });

    it('addSubscription no duplica; removeSubscription quita solo ese tópico', () => {
        store.addSubscription('a');
        store.addSubscription('a');
        store.addSubscription('b');
        expect(store.getState().subscriptions).toEqual(['a', 'b']);
        store.removeSubscription('a');
        expect(store.getState().subscriptions).toEqual(['b']);
        store.removeSubscription('inexistente');
        expect(store.getState().subscriptions).toEqual(['b']);
    });

    it('setConnection actualiza el estado y notifica a los suscriptores', () => {
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        store.setConnection('connecting');
        store.setConnection('connected');
        expect(store.getState().connection).toBe('connected');
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
        store.setConnection('disconnected');
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
