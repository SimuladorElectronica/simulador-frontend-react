import { useSyncExternalStore } from 'react';
import { mqttStore } from '../../stores/mqttStore';
import type { MqttState } from '../../stores/mqttStore';

/** Estado del monitor MQTT (conexión, mensajes y suscripciones). */
export function useMqtt(): MqttState {
    return useSyncExternalStore(
        (onChange) => mqttStore.subscribe(onChange),
        () => mqttStore.getState(),
    );
}
