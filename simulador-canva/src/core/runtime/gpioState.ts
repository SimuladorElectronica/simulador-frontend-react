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

/** Clave: número GPIO -> estado */
export type GpioStates = Map<number, GpioState>;
