import { describe, it, expect, vi } from 'vitest';
import { ArduinoCore, ArduinoError, SleepSignal } from '@core/runtime/arduinoCore';
import { ARDUINO } from '@core/runtime/esp32Profile';
import { Esp32Manifest } from '@core/manifests';

function makeCore(clock = () => 0) {
    const dirty = vi.fn();
    const serial: string[] = [];
    const core = new ArduinoCore({
        manifest: Esp32Manifest,
        clock,
        onDirty: dirty,
        onSerial: (t) => serial.push(t),
    });
    return { core, dirty, serial };
}

describe('ArduinoCore (ESP32)', () => {
    it('pinMode OUTPUT válido no lanza y marca dirty', () => {
        const { core, dirty } = makeCore();
        core.pinMode(2, ARDUINO.OUTPUT);
        expect(core.getState(2).mode).toBe('output');
        expect(dirty).toHaveBeenCalled();
    });

    it('pinMode OUTPUT en pin inputOnly (34) lanza ArduinoError', () => {
        const { core } = makeCore();
        expect(() => core.pinMode(34, ARDUINO.OUTPUT)).toThrow(ArduinoError);
        expect(() => core.pinMode(34, ARDUINO.INPUT_PULLUP)).toThrow(ArduinoError);
    });

    it('pinMode en GPIO inexistente lanza', () => {
        const { core } = makeCore();
        expect(() => core.pinMode(99, ARDUINO.OUTPUT)).toThrow(/no existe/);
    });

    it('digitalWrite sin OUTPUT lanza; con OUTPUT guarda nivel y PWM se limpia', () => {
        const { core, dirty } = makeCore();
        expect(() => core.digitalWrite(2, ARDUINO.HIGH)).toThrow(/sin pinMode/);
        core.pinMode(2, ARDUINO.OUTPUT);
        core.digitalWrite(2, ARDUINO.HIGH);
        expect(core.getState(2).outputLevel).toBe(1);
        expect(core.outputVoltage(2)).toBeCloseTo(3.3, 5);
        core.analogWrite(2, 128);
        expect(core.outputVoltage(2)).toBeCloseTo((128 / 255) * 3.3, 5);
        core.digitalWrite(2, ARDUINO.LOW);
        expect(core.getState(2).pwmDuty).toBeNull();
        expect(core.outputVoltage(2)).toBe(0);
        expect(dirty).toHaveBeenCalled();
    });

    it('digitalRead aplica umbrales con histéresis', () => {
        const { core } = makeCore();
        core.pinMode(34, ARDUINO.INPUT);
        core.setPinVoltage(34, 3.3);
        expect(core.digitalRead(34)).toBe(1);
        core.setPinVoltage(34, 1.5); // zona muerta: conserva 1
        expect(core.digitalRead(34)).toBe(1);
        core.setPinVoltage(34, 0.1);
        expect(core.digitalRead(34)).toBe(0);
    });

    it('analogRead devuelve 12 bits', () => {
        const { core } = makeCore();
        core.pinMode(34, ARDUINO.INPUT);
        core.setPinVoltage(34, 3.3);
        expect(core.analogRead(34)).toBe(4095);
        core.setPinVoltage(34, 1.65);
        expect(core.analogRead(34)).toBe(2048); // round(0.5 * 4095)
        core.setPinVoltage(34, 5); // saturación
        expect(core.analogRead(34)).toBe(4095);
    });

    it('analogRead en pin sin ADC lanza', () => {
        const { core } = makeCore();
        // GPIO 17 (TX2) solo digitalIn/digitalOut
        expect(() => core.analogRead(17)).toThrow(/ADC/);
    });

    it('delay lanza SleepSignal con wakeUp correcto (reloj virtual)', () => {
        const { core } = makeCore(() => 10_000);
        expect(() => core.delay(500)).toThrow(SleepSignal);
        try {
            core.delay(500);
        } catch (e) {
            expect((e as SleepSignal).wakeUpTimeUs).toBe(510_000);
        }
        expect(() => core.delayMicroseconds(250)).toThrow(SleepSignal);
        expect(core.millis()).toBe(10);
        expect(core.micros()).toBe(10_000);
    });

    it('serialPrint/println llegan al callback en orden', () => {
        const { core, serial } = makeCore();
        core.serialPrint('hola');
        core.serialPrintln('mundo');
        core.serialPrintln();
        expect(serial).toEqual(['hola', 'mundo\n', '\n']);
    });
});
