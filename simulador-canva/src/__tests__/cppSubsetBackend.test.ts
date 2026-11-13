import { describe, it, expect } from 'vitest';
import { cppSubsetBackend } from '@core/runtime/cppSubsetBackend';
import { ArduinoCore } from '@core/runtime/arduinoCore';
import { ARDUINO } from '@core/runtime/esp32Profile';
import { Esp32Manifest } from '@core/manifests';

const BLINK = `
const int LED_PIN = 2;
void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}
void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`;

function makeHost(clockValue = 0) {
    const serial: string[] = [];
    const core = new ArduinoCore({
        manifest: Esp32Manifest,
        clock: () => clockValue,
        onSerial: (t) => serial.push(t),
    });
    return { core, serial };
}

describe('cppSubsetBackend (intérprete subset)', () => {
    it('compile OK con setup+loop; diagnósticos si faltan', () => {
        const ok = cppSubsetBackend.compile(BLINK, 'esp32@1');
        expect(ok.diagnostics).toEqual([]);
        expect(ok.program).toBeDefined();

        const bad = cppSubsetBackend.compile('void setup() {}', 'esp32@1');
        expect(bad.diagnostics.map((d) => d.code)).toContain('MISSING_LOOP');

        const badPlatform = cppSubsetBackend.compile(BLINK, 'uno@1');
        expect(badPlatform.diagnostics.map((d) => d.code)).toContain('UNSUPPORTED_PLATFORM');
    });

    it('setup se ejecuta y loop duerme en delay(500) con wakeUp correcto', () => {
        const { core } = makeHost(0);
        const { program } = cppSubsetBackend.compile(BLINK, 'esp32@1');
        const inst = cppSubsetBackend.createInstance(program, core);

        const r1 = cppSubsetBackend.resume(inst, 1000);
        expect(r1.type).toBe('sleeping');
        if (r1.type === 'sleeping') expect(r1.wakeUpTimeUs).toBe(500_000);
        expect(core.getState(2).outputLevel).toBe(1); // HIGH antes del delay

        // Segunda parte del loop: LOW + delay. El reloj del host es 0 (fijo en este test),
        // por lo que wakeUp = 0 + 500ms de nuevo.
        const r2 = cppSubsetBackend.resume(inst, 501_000);
        expect(r2.type).toBe('sleeping');
        if (r2.type === 'sleeping') expect(r2.wakeUpTimeUs).toBe(500_000);
        expect(core.getState(2).outputLevel).toBe(0);
    });

    it('soporta if/else con digitalRead, variables y Serial.println', () => {
        const SKETCH = `
void setup() {
  pinMode(34, INPUT);
  pinMode(2, OUTPUT);
  Serial.begin(115200);
}
void loop() {
  int v = digitalRead(34);
  if (v == HIGH) {
    digitalWrite(2, HIGH);
    Serial.println("alto");
  } else {
    digitalWrite(2, LOW);
    Serial.println("bajo");
  }
  delay(100);
}
`;
        const { core, serial } = makeHost(0);
        core.setPinVoltage(34, 3.3);
        const { program } = cppSubsetBackend.compile(SKETCH, 'esp32@1');
        const inst = cppSubsetBackend.createInstance(program, core);
        const r = cppSubsetBackend.resume(inst, 1000);
        expect(r.type).toBe('sleeping');
        expect(core.getState(2).outputLevel).toBe(1);
        expect(serial).toContain('alto\n');
    });

    it('soporta comparaciones con llamadas anidadas y operadores lógicos', () => {
        const SKETCH = `
void setup() {
  pinMode(34, INPUT);
  Serial.begin(115200);
  if (digitalRead(34) == LOW && 1 < 2) {
    Serial.println("a");
  }
  if (!digitalRead(34) || false) {
    Serial.println("b");
  }
  if (digitalRead(34) == HIGH) {
    Serial.println("c");
  }
}
void loop() {
  delay(10);
}
`;
        const { core, serial } = makeHost(0);
        const { program } = cppSubsetBackend.compile(SKETCH, 'esp32@1');
        const inst = cppSubsetBackend.createInstance(program, core);
        const r = cppSubsetBackend.resume(inst, 1000);

        expect(r.type).toBe('sleeping');
        expect(serial).toContain('a\n');
        expect(serial).toContain('b\n');
        expect(serial).not.toContain('c\n');
    });

    it('loop sin delay devuelve preempted (no cuelga)', () => {
        const SKETCH = `
void setup() {}
void loop() {
  int x = 1;
}
`;
        const { core } = makeHost(0);
        const { program } = cppSubsetBackend.compile(SKETCH, 'esp32@1');
        const inst = cppSubsetBackend.createInstance(program, core);
        const r = cppSubsetBackend.resume(inst, 1000);
        expect(r.type).toBe('preempted');
    });

    it('error de Arduino (pin inválido) devuelve faulted con diagnóstico', () => {
        const SKETCH = `
void setup() {
  pinMode(99, OUTPUT);
}
void loop() {
  delay(10);
}
`;
        const { core } = makeHost(0);
        const { program } = cppSubsetBackend.compile(SKETCH, 'esp32@1');
        const inst = cppSubsetBackend.createInstance(program, core);
        const r = cppSubsetBackend.resume(inst, 1000);
        expect(r.type).toBe('faulted');
        if (r.type === 'faulted') expect(r.diagnostic.code).toBe('ARDUINO_ERROR');
    });

    it('reset vuelve a ejecutar setup', () => {
        const { core } = makeHost(0);
        const { program } = cppSubsetBackend.compile(BLINK, 'esp32@1');
        const inst = cppSubsetBackend.createInstance(program, core);
        cppSubsetBackend.resume(inst, 1000);
        core.digitalWrite(2, ARDUINO.LOW);
        cppSubsetBackend.reset(inst);
        // Tras reset, setup corre de nuevo: pinMode OUTPUT (ya lo era) y loop HIGH
        const r = cppSubsetBackend.resume(inst, 1000);
        expect(r.type).toBe('sleeping');
        expect(core.getState(2).outputLevel).toBe(1);
    });
});
