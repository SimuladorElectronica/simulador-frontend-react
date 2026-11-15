import { useEffect, useMemo, useRef, useState } from 'react';
import { useMqtt } from './hooks/useMqtt';
import { mqttStore } from '../stores/mqttStore';
import { mqttProxy } from '../services/mqttProxy';
import { MqttMessageList } from './mqtt/MqttMessageList';
import { CONNECTION_BADGES, formatMessageLine } from './mqtt/mqttFormat';

/**
 * Monitor MQTT del panel derecho.
 *
 * Muestra el tráfico MQTT del simulador y del broker simulado:
 *  - TX: publicaciones del sketch (PubSubClient → MQTT_PUBLISH). Eco local:
 *    se muestran siempre, aunque el broker no esté disponible.
 *  - RX: mensajes que llegan del broker por las suscripciones activas.
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

            <MqttMessageList
                visible={visible}
                totalMessages={mqtt.messages.length}
                subscriptions={mqtt.subscriptions}
                filter={filter}
                onFilterChange={setFilter}
                onUnsubscribe={(topic) => mqttProxy.unsubscribeTopic(topic)}
                scrollRef={scrollRef}
            />
        </section>
    );
}
