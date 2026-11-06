import { describe, it, expect, beforeEach } from 'vitest';
import type { SimulationProjection } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { buildNetlist, solve } from '@core/solver';
import { LedManifest, Esp32Manifest } from '@core/manifests';
import { ArduinoCore } from '@core/runtime/arduinoCore';
import { cppSubsetBackend } from '@core/runtime/cppSubsetBackend';

const BLINK = `
const int LED_PIN = 2;
void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("inicio");
}
void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`;

describe('Integración: sketch blink -> LED parpadea en tiempo virtual', () => {
    beforeEach(() => ManifestRegistry.init());

    it('el LED alterna ON/OFF cada 500ms virtuales y el solver lo refleja', () => {
        const projection: SimulationProjection = {
            components: [
                { id: 'esp', type: 'core/esp32@1', params: {} },
                { id: 'led1', type: 'core/led@1', params: {} },
            ],
            wires: [
                { id: 'w1', from: { componentId: 'esp', pinId: 'gpio2' }, to: { componentId: 'led1', pinId: 'anode' } },
                { id: 'w2', from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp', pinId: 'gnd1' } },
            ],
            programs: [],
        };
        const netlist = buildNetlist(projection, [Esp32Manifest, LedManifest]);

        let now = 0;
        const serial: string[] = [];
        const core = new ArduinoCore({
            manifest: Esp32Manifest,
            clock: () => now,
            onSerial: (t) => serial.push(t),
        });

        const { program } = cppSubsetBackend.compile(BLINK, 'esp32@1');
        const inst = cppSubsetBackend.createInstance(program, core);

        const solveAndCheck = () => {
            const sol = solve(netlist, core.getGpioStates());
            expect(sol.converged).toBe(true);
            const padNet = netlist.elements.find((e) => e.id === 'esp:gpio_2')!.terminals.pad;
            core.setPinVoltage(2, sol.nodeVoltages[padNet]);
            return sol.elementResults['led1:d1'];
        };

        // t=0: setup + loop HIGH -> LED ON
        let r = cppSubsetBackend.resume(inst, now + 1000);
        expect(r.type).toBe('sleeping');
        if (r.type === 'sleeping') now = r.wakeUpTimeUs;
        let led = solveAndCheck();
        expect(led.conducting).toBe(true);
        expect(led.current).toBeGreaterThan(0.01);

        // t=500ms: loop LOW -> LED OFF
        r = cppSubsetBackend.resume(inst, now + 1000);
        expect(r.type).toBe('sleeping');
        if (r.type === 'sleeping') now = r.wakeUpTimeUs;
        led = solveAndCheck();
        expect(led.conducting).toBe(false);
        expect(led.current).toBeCloseTo(0, 3);

        // t=1000ms: loop HIGH otra vez -> LED ON
        r = cppSubsetBackend.resume(inst, now + 1000);
        if (r.type === 'sleeping') now = r.wakeUpTimeUs;
        led = solveAndCheck();
        expect(led.conducting).toBe(true);

        expect(serial).toContain('inicio\n');
        expect(now).toBe(1_500_000);
    });
});
