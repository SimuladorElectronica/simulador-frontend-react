import type { ComponentManifest, HostInterface } from '@types';
import { ARDUINO, ESP32_PROFILE, pinByGpio, hasCapability } from './esp32Profile';
import { createGpioState } from './gpioState';
import type { GpioState, GpioStates, GpioMode } from './gpioState';

/** Señal interna para suspender la ejecución virtual (delay/delayMicroseconds) */
export class SleepSignal {
    public wakeUpTimeUs: number;
    constructor(wakeUpTimeUs: number) {
        this.wakeUpTimeUs = wakeUpTimeUs;
    }
}

/** Error de uso del core (pin inválido, modo incompatible, etc.) */
export class ArduinoError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ArduinoError';
    }
}

export interface ArduinoCoreOptions {
    manifest: ComponentManifest;
    /** Reloj virtual (µs). Determinista: lo provee el worker. */
    clock: () => number;
    /** Se invoca cuando cambia el estado eléctrico de un pin (el solver debe recalcular) */
    onDirty?: () => void;
    /** Salida serie */
    onSerial?: (text: string) => void;
}

/**
 * Core de Arduino para ESP32: implementa HostInterface + API de sketch.
 * No conoce el solver: solo guarda estado por GPIO y valida contra el manifiesto.
 */
export class ArduinoCore implements HostInterface {
    private readonly manifest: ComponentManifest;
    private readonly clock: () => number;
    private readonly onDirty: () => void;
    private readonly onSerial: (text: string) => void;
    private states: GpioStates = new Map();

    constructor(opts: ArduinoCoreOptions) {
        this.manifest = opts.manifest;
        this.clock = opts.clock;
        this.onDirty = opts.onDirty ?? (() => undefined);
        this.onSerial = opts.onSerial ?? (() => undefined);
    }

    /* ---------------- utilidades ---------------- */

    private state(gpio: number): GpioState {
        let s = this.states.get(gpio);
        if (!s) {
            s = createGpioState(gpio);
            this.states.set(gpio, s);
        }
        return s;
    }

    private requirePin(gpio: number) {
        const pin = pinByGpio(this.manifest, gpio);
        if (!pin) {
            throw new ArduinoError(`GPIO ${gpio} no existe en ${this.manifest.id}`);
        }
        return pin;
    }

    /** Vista de solo lectura para el solver/worker */
    getGpioStates(): GpioStates {
        return this.states;
    }

    getState(gpio: number): GpioState {
        return this.state(gpio);
    }

    /** El worker lo llama tras cada solve con el voltaje del pad de cada GPIO */
    setPinVoltage(gpio: number, voltage: number) {
        this.state(gpio).voltage = voltage;
    }

    reset() {
        this.states.clear();
    }

    /* ---------------- HostInterface ---------------- */

    pinMode(gpio: number, mode: number): void {
        const pin = this.requirePin(gpio);
        let gpioMode: GpioMode;
        switch (mode) {
            case ARDUINO.INPUT:
                gpioMode = 'input';
                break;
            case ARDUINO.OUTPUT:
                if (pin.gpio?.inputOnly) {
                    throw new ArduinoError(`GPIO ${gpio} es inputOnly: no admite OUTPUT`);
                }
                if (!hasCapability(pin, 'digitalOut')) {
                    throw new ArduinoError(`GPIO ${gpio} no tiene capacidad digitalOut`);
                }
                gpioMode = 'output';
                break;
            case ARDUINO.INPUT_PULLUP:
                if (pin.gpio?.inputOnly) {
                    throw new ArduinoError(`GPIO ${gpio} (inputOnly) no tiene pull-up interno`);
                }
                gpioMode = 'inputPullUp';
                break;
            case ARDUINO.INPUT_PULLDOWN:
                if (pin.gpio?.inputOnly) {
                    throw new ArduinoError(`GPIO ${gpio} (inputOnly) no tiene pull-down interno`);
                }
                gpioMode = 'inputPullDown';
                break;
            default:
                throw new ArduinoError(`Modo de pin desconocido: ${mode}`);
        }
        const s = this.state(gpio);
        const changed = s.mode !== gpioMode;
        s.mode = gpioMode;
        if (changed) this.onDirty();
    }

    digitalWrite(gpio: number, level: number): void {
        this.requirePin(gpio);
        const s = this.state(gpio);
        if (s.mode !== 'output') {
            throw new ArduinoError(`digitalWrite en GPIO ${gpio} sin pinMode(OUTPUT)`);
        }
        const lvl = level === 0 ? 0 : 1;
        if (s.outputLevel !== lvl || s.pwmDuty !== null) {
            s.outputLevel = lvl as 0 | 1;
            s.pwmDuty = null;
            this.onDirty();
        }
    }

    analogWrite(gpio: number, duty: number): void {
        const pin = this.requirePin(gpio);
        if (!hasCapability(pin, 'pwm') && !(gpio === 25 || gpio === 26)) {
            throw new ArduinoError(`GPIO ${gpio} no admite PWM (analogWrite)`);
        }
        const s = this.state(gpio);
        if (s.mode !== 'output') {
            throw new ArduinoError(`analogWrite en GPIO ${gpio} sin pinMode(OUTPUT)`);
        }
        const d = Math.max(0, Math.min(ESP32_PROFILE.pwmMax, Math.floor(duty)));
        if (s.pwmDuty !== d) {
            s.pwmDuty = d;
            this.onDirty();
        }
    }

    digitalRead(gpio: number): number {
        this.requirePin(gpio);
        const s = this.state(gpio);
        if (s.voltage >= ESP32_PROFILE.inputHigh) s.lastDigital = 1;
        else if (s.voltage <= ESP32_PROFILE.inputLow) s.lastDigital = 0;
        return s.lastDigital;
    }

    analogRead(gpio: number): number {
        const pin = this.requirePin(gpio);
        if (!hasCapability(pin, 'adc')) {
            throw new ArduinoError(`GPIO ${gpio} no tiene capacidad ADC`);
        }
        const s = this.state(gpio);
        const norm = Math.max(0, Math.min(1, s.voltage / ESP32_PROFILE.logicVoltage));
        return Math.round(norm * ESP32_PROFILE.adcMax);
    }

    delay(ms: number): void {
        throw new SleepSignal(this.clock() + Math.max(0, ms) * 1000);
    }

    delayMicroseconds(us: number): void {
        throw new SleepSignal(this.clock() + Math.max(0, us));
    }

    millis(): number {
        return Math.floor(this.clock() / 1000);
    }

    micros(): number {
        return Math.floor(this.clock());
    }

    getTimeUs(): number {
        return this.clock();
    }

    serialPrint(text: string): void {
        this.onSerial(text);
    }

    serialPrintln(text?: string): void {
        this.onSerial((text ?? '') + '\n');
    }

    /** Tensión de salida que el solver debe imponer en el pad (promedio DC) */
    outputVoltage(gpio: number): number | null {
        const s = this.states.get(gpio);
        if (!s || s.mode !== 'output') return null;
        if (s.pwmDuty !== null) {
            return (s.pwmDuty / ESP32_PROFILE.pwmMax) * ESP32_PROFILE.logicVoltage;
        }
        return s.outputLevel === 1 ? ESP32_PROFILE.logicVoltage : 0;
    }
}
