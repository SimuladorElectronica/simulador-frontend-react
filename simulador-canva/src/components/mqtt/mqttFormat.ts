import type { MqttConnectionState, MqttMessage } from '../../stores/mqttStore';

interface ConnectionBadge {
    label: string;
    color: string;
}

export const CONNECTION_BADGES: Record<MqttConnectionState, ConnectionBadge> = {
    connected: { label: 'conectado', color: '#a5d6a7' },
    connecting: { label: 'conectando…', color: '#ffd54f' },
    disconnected: { label: 'desconectado', color: '#ef9a9a' },
};

/** Línea del monitor: `[t=123us] TX topic: payload` (sketch) o `[hh:mm:ss] RX …` (broker). */
export function formatMessageLine(message: MqttMessage): string {
    const prefix =
        message.source === 'sketch'
            ? `[t=${message.virtualTimeUs ?? 0}us] TX`
            : `[${new Date(message.timestamp).toLocaleTimeString('es-AR', { hour12: false })}] RX`;
    return `${prefix} ${message.topic}: ${message.payload}`;
}
