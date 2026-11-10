/**
 * Estado eléctrico/lógico de un pin GPIO, compartido entre:
 *  - ArduinoCore (lo muta con pinMode/digitalWrite/analogWrite)
 *  - Solver nodal (lo lee para modelar el driver del pin)
 *  - Worker (actualiza `voltage` tras cada solve, para digitalRead/analogRead)
 */

export type GpioMode = 'input' | 'output' | 'inputPullUp' | 'inputPullDown';

export interface GpioState {
    gpio: number;
    mode: GpioMode;
    /** Nivel lógico de salida (digitalWrite) */
    outputLevel: 0 | 1;
    /** Duty PWM 0-255 (analogWrite); null = sin PWM */
    pwmDuty: number | null;
    /** Último voltaje observado en el pad por el solver (V) */
    voltage: number;
    /** Último nivel digital leído (histéresis entre inputLow/inputHigh) */
    lastDigital: 0 | 1;
}

export function createGpioState(gpio: number): GpioState {
    return {
        gpio,
        mode: 'input',
        outputLevel: 0,
        pwmDuty: null,
        voltage: 0,
        lastDigital: 0,
    };
}

/** Estados de UN MCU: clave = número GPIO -> estado */
export type GpioStates = Map<number, GpioState>;

/**
 * Estados de VARIOS MCU: clave = `${componentId}:${número GPIO}`.
 *
 * Sin el prefijo del componente, dos ESP32 con el mismo GPIO (p. ej. el 2
 * del sketch por defecto) se pisarían entre sí y ambos pines quedarían
 * manejados por el estado de una sola placa.
 */
export type GpioStateIndex = Map<string, GpioState>;

/** Clave del índice multi-MCU. */
export function gpioStateKey(componentId: string, gpio: number): string {
    return `${componentId}:${gpio}`;
}

/** Copia los estados de un MCU al índice multi-MCU. */
export function addGpioStates(
    index: GpioStateIndex,
    componentId: string,
    states: GpioStates,
): GpioStateIndex {
    for (const [gpio, state] of states) {
        index.set(gpioStateKey(componentId, gpio), state);
    }
    return index;
}

/**
 * Entrada aceptada por el solver:
 *  - `GpioStates` (un solo MCU): atajo cómodo para tests/uso embebido.
 *  - `GpioStateIndex` (varios MCU): la usa el worker, con clave por componente.
 */
export type GpioStatesInput = GpioStates | GpioStateIndex;

/**
 * Busca el estado de un GPIO para un elemento del netlist.
 *
 * Si el elemento declara `componentId` se usa la clave multi-MCU; si no,
 * se cae al formato de un solo MCU (compatibilidad con los tests).
 */
export function findGpioState(
    states: GpioStatesInput | undefined,
    componentId: string | undefined,
    gpio: number,
): GpioState | undefined {
    if (!states) return undefined;
    if (componentId) {
        const byComponent = (states as GpioStateIndex).get(gpioStateKey(componentId, gpio));
        if (byComponent) return byComponent;
    }
    return (states as GpioStates).get(gpio);
}
