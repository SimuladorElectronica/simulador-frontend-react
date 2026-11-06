import { describe, it, expect, beforeEach } from 'vitest';
import type { SimulationProjection, ComponentManifest } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { buildNetlist, solve } from '@core/solver';
import { LedManifest, Esp32Manifest } from '@core/manifests';
import { ArduinoCore } from '@core/runtime/arduinoCore';
import { ARDUINO } from '@core/runtime/esp32Profile';

function makeProjection(): SimulationProjection {
    return {
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
}

function manifestArray(...m: ComponentManifest[]) {
    return m;
}

describe('GPIO <-> Solver (driver push-pull + PWM DC)', () => {
    beforeEach(() => ManifestRegistry.init());

    it('GPIO2 OUTPUT HIGH enciende el LED (V≈3.3, I≈0.135A con Rout 40Ω)', () => {
        const netlist = buildNetlist(makeProjection(), manifestArray(Esp32Manifest, LedManifest));
        const core = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        core.pinMode(2, ARDUINO.OUTPUT);
        core.digitalWrite(2, ARDUINO.HIGH);

        const sol = solve(netlist, core.getGpioStates());
        expect(sol.converged).toBe(true);

        const led = sol.elementResults['led1:d1'];
        expect(led.conducting).toBe(true);
        // Con Rout=40 en serie: I = (3.3-1.8)/(40+10) = 0.03A aprox (modelo Thevenin)
        expect(led.current).toBeGreaterThan(0.02);
        expect(led.current).toBeLessThan(0.1);

        // El voltaje del pad queda registrado en el core
        const padNet = netlist.elements.find((e) => e.id === 'esp:gpio_2')!.terminals.pad;
        core.setPinVoltage(2, sol.nodeVoltages[padNet]);
        expect(core.digitalRead(2)).toBe(1);
    });

    it('GPIO2 OUTPUT LOW mantiene el LED apagado', () => {
        const netlist = buildNetlist(makeProjection(), manifestArray(Esp32Manifest, LedManifest));
        const core = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        core.pinMode(2, ARDUINO.OUTPUT);
        core.digitalWrite(2, ARDUINO.LOW);

        const sol = solve(netlist, core.getGpioStates());
        const led = sol.elementResults['led1:d1'];
        expect(led.conducting).toBe(false);
        expect(led.current).toBeCloseTo(0, 3);
    });

    it('analogWrite 50% produce tensión promedio ≈1.65V en el pad', () => {
        const netlist = buildNetlist(makeProjection(), manifestArray(Esp32Manifest, LedManifest));
        const core = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        core.pinMode(2, ARDUINO.OUTPUT);
        core.analogWrite(2, 128);

        const sol = solve(netlist, core.getGpioStates());
        const padNet = netlist.elements.find((e) => e.id === 'esp:gpio_2')!.terminals.pad;
        const vPad = sol.nodeVoltages[padNet];
        // Sin carga sería (128/255)*3.3 ≈ 1.656V; con el LED cargando, algo menor pero > 0.5V
        expect(vPad).toBeGreaterThan(0.5);
        expect(vPad).toBeLessThanOrEqual((128 / 255) * 3.3 + 1e-6);
    });

    it('regresión: con estados INPUT para TODOS los GPIO (como hace el worker) no hay singular', () => {
        const netlist = buildNetlist(makeProjection(), manifestArray(Esp32Manifest, LedManifest));
        const core = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });

        // El worker registra el voltaje de cada pad tras cada solve, creando
        // estados INPUT para todos los GPIO. Eso no debe volver singular la MNA.
        let sol = solve(netlist, core.getGpioStates());
        for (const elem of netlist.elements) {
            if (elem.primitive === 'gpio' && elem.params.gpioNumber !== undefined) {
                core.setPinVoltage(elem.params.gpioNumber, sol.nodeVoltages[elem.terminals.pad] ?? 0);
            }
        }
        sol = solve(netlist, core.getGpioStates());
        expect(sol.converged).toBe(true);

        core.pinMode(2, ARDUINO.OUTPUT);
        core.digitalWrite(2, ARDUINO.HIGH);
        sol = solve(netlist, core.getGpioStates());
        expect(sol.converged).toBe(true);
        expect(sol.elementResults['led1:d1'].conducting).toBe(true);
    });

    it('INPUT_PULLDOWN sin conexión externa mantiene el pad a ~0V', () => {
        const core = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        core.pinMode(2, ARDUINO.INPUT_PULLDOWN);
        const proj: SimulationProjection = {
            components: [{ id: 'esp', type: 'core/esp32@1', params: {} }],
            wires: [],
            programs: [],
        };
        const nl2 = buildNetlist(proj, manifestArray(Esp32Manifest));
        const sol = solve(nl2, core.getGpioStates());
        expect(sol.converged).toBe(true);
        const padNet = nl2.elements.find((e) => e.id === 'esp:gpio_2')!.terminals.pad;
        expect(sol.nodeVoltages[padNet]).toBeCloseTo(0, 2);
    });

    it('INPUT_PULLUP sin conexión externa eleva el pad a ~3.3V', () => {
        const core = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        core.pinMode(2, ARDUINO.INPUT_PULLUP);
        // Desconectar el LED: solo el pull-up contra el pad
        const proj: SimulationProjection = {
            components: [{ id: 'esp', type: 'core/esp32@1', params: {} }],
            wires: [],
            programs: [],
        };
        const nl2 = buildNetlist(proj, manifestArray(Esp32Manifest));
        const sol = solve(nl2, core.getGpioStates());
        const padNet = nl2.elements.find((e) => e.id === 'esp:gpio_2')!.terminals.pad;
        expect(sol.nodeVoltages[padNet]).toBeCloseTo(3.3, 2);
    });
});
