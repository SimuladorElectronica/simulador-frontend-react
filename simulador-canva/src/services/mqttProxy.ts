import { mqttStore } from '../stores/mqttStore';

/**
 * Cliente WebSocket del broker MQTT simulado (backend-iot-fastapi).
 *
 * Protocolo (ver backend-iot-fastapi/main.py y mqtt_broker.py):
 *
 *   WS  /ws/{client_id}
 *   →   { action: 'subscribe' | 'unsubscribe', topic }
 *   →   { action: 'publish', topic, payload }
 *   ←   { type: 'mqtt_message', topic, payload, timestamp }  (epoch, segundos)
 *   ←   { type: 'system', ... }                              (acks, se ignoran)
 *   ←   { error: '...' }                                     (se ignora)
 *
 * URL: `VITE_IOT_WS_URL` (default `ws://localhost:8000/ws/simulador-frontend`).
 *
 * El monitor sigue siendo útil sin broker: las publicaciones del sketch se
 * muestran por eco local (`mqttStore.recordLocalPublish`); este servicio solo
 * agrega el tramo "de verdad" (publicar hacia otros clientes y recibir los
 * mensajes de las suscripciones).
 *
 * Reconexión automática con backoff mientras el monitor esté "conectado";
 * `disconnect()` corta y NO reconecta.
 */
const DEFAULT_WS_URL = 'ws://localhost:8000/ws/simulador-frontend';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;

export function resolveMqttWsUrl(): string {
    return (import.meta.env.VITE_IOT_WS_URL as string | undefined) ?? DEFAULT_WS_URL;
}

class MqttProxy {
    private ws: WebSocket | null = null;
    private started = false;
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Hook para consumidores que quieren REACCIONAR a un mensaje del broker
     * (p. ej. el Worker: entregarlo al callback `setCallback` del sketch).
     * Se llama después de registrar el mensaje en el store, solo para
     * `mqtt_message` válidos.
     */
    public onMessage: ((topic: string, payload: string) => void) | null = null;

    /** Conecta al broker (idempotente). Sin WebSocket disponible queda desconectado. */
    connect() {
        this.started = true;
        if (typeof WebSocket === 'undefined') {
            console.warn('[mqtt] WebSocket no disponible en este entorno');
            return;
        }
        const readyState = this.ws?.readyState;
        if (
            this.ws &&
            (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING)
        ) {
            return;
        }
        this.open();
    }

    /** Desconexión manual: corta y NO reconecta. */
    disconnect() {
        this.started = false;
        this.clearReconnectTimer();
        const ws = this.ws;
        this.ws = null;
        if (ws) {
            try {
                ws.close();
            } catch {
                /* el broker puede haber cerrado ya */
            }
        }
        mqttStore.setConnection('disconnected');
    }

    private open() {
        mqttStore.setConnection('connecting');
        const ws = new WebSocket(resolveMqttWsUrl());
        this.ws = ws;

        ws.onopen = () => {
            if (this.ws !== ws) return;
            this.reconnectAttempts = 0;
            mqttStore.setConnection('connected');
            // Re-suscribir los tópicos pedidos mientras no había conexión
            for (const topic of mqttStore.getState().subscriptions) {
                this.send({ action: 'subscribe', topic });
            }
        };

        ws.onmessage = (event: MessageEvent<unknown>) => {
            if (this.ws !== ws) return;
            this.handleMessage(event.data);
        };

        ws.onerror = () => {
            /* onclose gestiona el estado y la reconexión */
        };

        ws.onclose = () => {
            if (this.ws === ws) this.ws = null;
            mqttStore.setConnection('disconnected');
            if (this.started) this.scheduleReconnect();
        };
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
        const delay = Math.min(BASE_DELAY_MS * 2 ** this.reconnectAttempts, MAX_DELAY_MS);
        this.reconnectAttempts += 1;
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            if (this.started) this.open();
        }, delay);
    }

    private clearReconnectTimer() {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private send(message: Record<string, unknown>): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Publica en el broker. `false` si no está conectado (el eco local del
     * sketch ya quedó registrado en el store por el llamador).
     */
    publish(topic: string, payload: string): boolean {
        return this.send({ action: 'publish', topic, payload });
    }

    /** Suscribe el frontend a un tópico (idempotente en el store). */
    subscribeTopic(topic: string) {
        const normalized = topic.trim();
        if (!normalized) return;
        mqttStore.addSubscription(normalized);
        this.send({ action: 'subscribe', topic: normalized });
    }

    unsubscribeTopic(topic: string) {
        mqttStore.removeSubscription(topic);
        this.send({ action: 'unsubscribe', topic });
    }

    private handleMessage(raw: unknown) {
        let parsed: unknown;
        try {
            parsed = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(String(raw));
        } catch {
            return; // frame no-JSON: ignorar, como un mensaje corrupto del broker
        }
        if (!parsed || typeof parsed !== 'object') return;
        const msg = parsed as {
            type?: unknown;
            topic?: unknown;
            payload?: unknown;
            timestamp?: unknown;
        };
        if (msg.type !== 'mqtt_message') return; // acks {type:'system'} y errores: ignorados
        const topic = String(msg.topic ?? '');
        const payload = String(msg.payload ?? '');
        mqttStore.recordBrokerMessage(
            topic,
            payload,
            typeof msg.timestamp === 'number' ? msg.timestamp : undefined,
        );
        try {
            this.onMessage?.(topic, payload);
        } catch (error) {
            console.error('[mqtt] onMessage falló', error);
        }
    }

    /** Solo para tests: corta la conexión y el backoff. */
    resetForTests() {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.onMessage = null;
    }
}

export const mqttProxy = new MqttProxy();
