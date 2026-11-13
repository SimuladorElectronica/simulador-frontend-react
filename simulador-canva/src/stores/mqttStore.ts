export type MqttConnectionState = 'disconnected' | 'connecting' | 'connected';
export type MqttMessageSource = 'sketch' | 'broker';

export interface MqttMessage {
    id: number;
    topic: string;
    payload: string;
    /** epoch ms del mensaje (broker) o del momento de recepción local */
    timestamp: number;
    /** Tiempo virtual del sketch (µs) si el mensaje viene del Worker */
    virtualTimeUs?: number;
    /** 'sketch' = publicado por el ESP32 simulado, 'broker' = llegó por suscripción */
    source: MqttMessageSource;
}

export interface MqttState {
    connection: MqttConnectionState;
    messages: MqttMessage[];
    /** Tópicos suscriptos desde el panel (se re-suscriben al reconectar) */
    subscriptions: string[];
}

/** Mismo tope que el monitor serie: el buffer no crece sin límite. */
const MAX_MESSAGES = 100;

const INITIAL_STATE: MqttState = {
    connection: 'disconnected',
    messages: [],
    subscriptions: [],
};

/**
 * Estado del monitor MQTT (panel derecho, bajo la consola serie).
 *
 * Alimentado por dos vías:
 *  - `recordLocalPublish`: publicaciones del sketch (Worker → MQTT_PUBLISH).
 *    Se muestran siempre, aunque no haya broker conectado (eco local).
 *  - `recordBrokerMessage`: mensajes entrantes del broker vía WebSocket
 *    (`mqttProxy`), solo si hay suscripciones activas.
 */
export class MqttStore {
    private state: MqttState = INITIAL_STATE;
    private listeners = new Set<() => void>();
    private nextId = 1;

    private rebuild(patch: Partial<MqttState>) {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach((l) => l());
    }

    private pushMessage(message: Omit<MqttMessage, 'id'>) {
        const messages = [
            ...this.state.messages.slice(-(MAX_MESSAGES - 1)),
            { ...message, id: this.nextId++ },
        ];
        this.rebuild({ messages });
    }

    /** Publicación local del sketch (siempre visible, haya o no broker). */
    recordLocalPublish(topic: string, payload: string, virtualTimeUs?: number) {
        this.pushMessage({
            topic,
            payload,
            timestamp: Date.now(),
            virtualTimeUs,
            source: 'sketch',
        });
    }

    /** Mensaje entrante del broker. El backend envía `time.time()` (segundos). */
    recordBrokerMessage(topic: string, payload: string, timestampSeconds?: number) {
        const timestamp =
            typeof timestampSeconds === 'number' && Number.isFinite(timestampSeconds)
                ? Math.round(timestampSeconds * 1000)
                : Date.now();
        this.pushMessage({ topic, payload, timestamp, source: 'broker' });
    }

    setConnection(connection: MqttConnectionState) {
        this.rebuild({ connection });
    }

    addSubscription(topic: string) {
        if (this.state.subscriptions.includes(topic)) return;
        this.rebuild({ subscriptions: [...this.state.subscriptions, topic] });
    }

    removeSubscription(topic: string) {
        if (!this.state.subscriptions.includes(topic)) return;
        this.rebuild({ subscriptions: this.state.subscriptions.filter((t) => t !== topic) });
    }

    /** Botón "Limpiar" del monitor. */
    clearMessages() {
        this.rebuild({ messages: [] });
    }

    getState(): MqttState {
        return this.state;
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Solo para tests: vuelve al estado inicial. */
    reset() {
        this.nextId = 1;
        this.state = INITIAL_STATE;
        this.listeners.forEach((l) => l());
    }
}

export const mqttStore = new MqttStore();
