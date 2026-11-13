import { useEffect, useMemo, useRef, useState } from 'react';
import { useMqtt } from './hooks/useMqtt';
import { mqttStore } from '../stores/mqttStore';
import { mqttProxy } from '../services/mqttProxy';
import type { MqttConnectionState, MqttMessage } from '../stores/mqttStore';

interface ConnectionBadge {
    label: string;
    color: string;
}

const CONNECTION_BADGES: Record<MqttConnectionState, ConnectionBadge> = {
    connected: { label: 'conectado', color: '#a5d6a7' },
    connecting: { label: 'conectando…', color: '#ffd54f' },
    disconnected: { label: 'desconectado', color: '#ef9a9a' },
};

/** Línea del monitor: `[t=123us] TX topic: payload` (sketch) o `[hh:mm:ss] RX …` (broker). */
function formatMessageLine(message: MqttMessage): string {
    const prefix =
        message.source === 'sketch'
            ? `[t=${message.virtualTimeUs ?? 0}us] TX`
            : `[${new Date(message.timestamp).toLocaleTimeString('es-AR', { hour12: false })}] RX`;
    return `${prefix} ${message.topic}: ${message.payload}`;
}

/**
 * Monitor MQTT del panel derecho.
 *
 * Muestra el tráfico MQTT del simulador y del broker simulado:
 *  - TX: publicaciones del sketch (PubSubClient → MQTT_PUBLISH). Eco local:
 *    se muestran siempre, aunque el broker no esté disponible.
 *  - RX: mensajes que llegan del broker por las suscripciones activas: las del
 *    sketch (`client.subscribe()` en el código) o las del panel, por WebSocket
 *    a `VITE_IOT_WS_URL` (default `ws://localhost:8000/ws/simulador-frontend`).
 *
 * Controles: conectar/desconectar, suscribirse a un tópico, filtro por
 * tópico o payload, limpiar y copiar. Mismo estilo oscuro que la consola UART.
 */
export function MqttMonitor() {
    const mqtt = useMqtt();
    const [filter, setFilter] = useState('');
    const [topicInput, setTopicInput] = useState('');
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLPreElement>(null);

    // El monitor visible implica que el usuario quiere el broker: conectar al montar.
    useEffect(() => {
        mqttProxy.connect();
    }, []);

    const needle = filter.trim().toLowerCase();
    const visible = useMemo(
        () =>
            needle === ''
                ? mqtt.messages
                : mqtt.messages.filter(
                      (m) =>
                          m.topic.toLowerCase().includes(needle) ||
                          m.payload.toLowerCase().includes(needle),
                  ),
        [mqtt.messages, needle],
    );
    const bufferText = useMemo(
        () => mqtt.messages.map(formatMessageLine).join('\n'),
        [mqtt.messages],
    );

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [mqtt.messages]);

    const badge = CONNECTION_BADGES[mqtt.connection];
    const isConnected = mqtt.connection === 'connected';
    const canSubscribe = topicInput.trim().length > 0;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(bufferText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    };

    const subscribe = () => {
        if (!canSubscribe) return;
        mqttProxy.subscribeTopic(topicInput);
        setTopicInput('');
    };

    return (
        <section aria-label="Monitor MQTT">
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginBottom: 6,
                }}
            >
                <strong style={{ fontSize: 11 }}>Monitor MQTT</strong>
                <span
                    data-testid="mqtt-connection"
                    style={{ color: badge.color, fontSize: 10 }}
                    title="Broker simulado (backend-iot-fastapi)"
                >
                    ● {badge.label}
                </span>
                <button
                    onClick={() => (isConnected ? mqttProxy.disconnect() : mqttProxy.connect())}
                >
                    {isConnected ? 'Desconectar' : 'Conectar'}
                </button>
                <button onClick={() => mqttStore.clearMessages()}>Limpiar</button>
                <button onClick={copy}>{copied ? '✓ Copiado' : 'Copiar'}</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                    aria-label="Tópico a suscribir"
                    placeholder="Tópico a suscribir (p. ej. esp32/led)…"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') subscribe();
                    }}
                    style={{ flex: 1, minWidth: 0 }}
                />
                <button onClick={subscribe} disabled={!canSubscribe}>
                    Suscribir
                </button>
            </div>

            {mqtt.subscriptions.length > 0 && (
                <div
                    data-testid="mqtt-subscriptions"
                    style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}
                >
                    {mqtt.subscriptions.map((topic) => (
                        <span
                            key={topic}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 10,
                                border: '1px solid #455a64',
                                color: '#b0bec5',
                            }}
                        >
                            {topic}
                            <button
                                onClick={() => mqttProxy.unsubscribeTopic(topic)}
                                aria-label={`Desuscribir ${topic}`}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#ef9a9a',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontSize: 11,
                                }}
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <input
                aria-label="Filtrar mensajes MQTT"
                placeholder="Filtrar por tópico o payload…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
            />

            <pre
                ref={scrollRef}
                data-testid="mqtt-output"
                style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 140,
                    overflowY: 'auto',
                    color: '#90caf9',
                    background: '#1b262c',
                    padding: 6,
                    borderRadius: 4,
                }}
            >
                {visible.map(formatMessageLine).join('\n') || '(sin mensajes)'}
            </pre>

            <div style={{ color: '#90a4ae', fontSize: 10, marginTop: 4 }}>
                {mqtt.messages.length} mensajes · {mqtt.subscriptions.length} suscripciones
                {' · TX = sketch · RX = broker'}
            </div>
        </section>
    );
}
