import type { RefObject } from 'react';
import type { MqttMessage } from '../../stores/mqttStore';
import { formatMessageLine } from './mqttFormat';

interface MqttMessageListProps {
    visible: MqttMessage[];
    totalMessages: number;
    subscriptions: readonly string[];
    filter: string;
    onFilterChange: (value: string) => void;
    onUnsubscribe: (topic: string) => void;
    scrollRef: RefObject<HTMLPreElement | null>;
}

/** Suscripciones activas, filtro y salida del monitor MQTT. */
export function MqttMessageList({
    visible,
    totalMessages,
    subscriptions,
    filter,
    onFilterChange,
    onUnsubscribe,
    scrollRef,
}: MqttMessageListProps) {
    return (
        <>
            {subscriptions.length > 0 && (
                <div
                    data-testid="mqtt-subscriptions"
                    style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}
                >
                    {subscriptions.map((topic) => (
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
                                onClick={() => onUnsubscribe(topic)}
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
                onChange={(e) => onFilterChange(e.target.value)}
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
                {totalMessages} mensajes · {subscriptions.length} suscripciones
                {' · TX = sketch · RX = broker'}
            </div>
        </>
    );
}
