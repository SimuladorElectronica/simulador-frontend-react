import { describe, it, expect, beforeEach } from 'vitest';
import type { SimulationProjection } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { buildNetlist, solve } from '@core/solver';
import { LedManifest, Esp32Manifest } from '@core/manifests';
import { ArduinoCore } from '@core/runtime/arduinoCore';
import { ARDUINO } from '@core/runtime/esp32Profile';
import { addGpioStates } from '@core/runtime/gpioState';
import type { GpioStateIndex } from '@core/runtime/gpioState';

/**
 * Regresiones del simulador con más de un MCU.
 *
 * Dos fallos que se combinaban al correr dos ESP32:
 *  1. El solver solo tomaba la PRIMERA `groundRef` como 0 V, así que la
 *     segunda placa quedaba eléctricamente flotante (matriz singular →
 *     `noConvergence` y la simulación se detenía).
 *  2. Los estados GPIO se fusionaban por número, así que el GPIO 2 de una
 *     placa pisaba el de la otra.
 */

function twoBoards(sharedGround: boolean): SimulationProjection {
    const wires: SimulationProjection['wires'] = [
        { id: 'w1', from: { componentId: 'esp1', pinId: 'gpio2' }, to: { componentId: 'led1', pinId: 'anode' } },
        { id: 'w2', from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp1', pinId: 'gnd1' } },
        { id: 'w3', from: { componentId: 'esp2', pinId: 'gpio2' }, to: { componentId: 'led2', pinId: 'anode' } },
        { id: 'w4', from: { componentId: 'led2', pinId: 'cathode' }, to: { componentId: 'esp2', pinId: 'gnd1' } },
    ];
    if (sharedGround) {
        wires.push({
            id: 'w5',
            from: { componentId: 'esp1', pinId: 'gnd1' },
            to: { componentId: 'esp2', pinId: 'gnd1' },
        });
    }
    return {
        components: [
            { id: 'esp1', type: 'core/esp32@1', params: {} },
            { id: 'led1', type: 'core/led@1', params: {} },
            { id: 'esp2', type: 'core/esp32@1', params: {} },
            { id: 'led2', type: 'core/led@1', params: {} },
        ],
        wires,
        programs: [],
    };
}

/** Como lo arma el worker: estados por `componentId:gpio`. */
function collect(cores: Record<string, ArduinoCore>): GpioStateIndex {
    const index: GpioStateIndex = new Map();
    for (const [id, core] of Object.entries(cores)) {
        addGpioStates(index, id, core.getGpioStates());
    }
    return index;
}

function drive(core: ArduinoCore, level: number) {
    core.pinMode(2, ARDUINO.OUTPUT);
    core.digitalWrite(2, level);
}

describe('Solver multi-MCU: dos ESP32 en el mismo circuito', () => {
    beforeEach(() => ManifestRegistry.init());

    it('dos placas sin tierra común convergen (cada groundRef es 0 V)', () => {
        const netlist = buildNetlist(twoBoards(false), [Esp32Manifest, LedManifest]);
        const esp1 = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        const esp2 = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        drive(esp1, ARDUINO.HIGH);
        drive(esp2, ARDUINO.HIGH);

        const sol = solve(netlist, collect({ esp1, esp2 }));

        expect(sol.converged).toBe(true);
        // Ambos LEDs encienden: ninguna placa queda flotando
        expect(sol.elementResults['led1:d1'].conducting).toBe(true);
        expect(sol.elementResults['led2:d1'].conducting).toBe(true);
    });

    it('con tierra común, el GPIO 2 de cada placa conserva su propio estado', () => {
        const netlist = buildNetlist(twoBoards(true), [Esp32Manifest, LedManifest]);
        const esp1 = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        const esp2 = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        drive(esp1, ARDUINO.HIGH); // placa 1: LED encendido
        drive(esp2, ARDUINO.LOW); // placa 2: LED apagado (mismo GPIO 2)

        const sol = solve(netlist, collect({ esp1, esp2 }));

        expect(sol.converged).toBe(true);
        expect(sol.elementResults['led1:d1'].conducting).toBe(true);
        expect(sol.elementResults['led2:d1'].conducting).toBe(false);
        expect(sol.elementResults['led2:d1'].current).toBeCloseTo(0, 6);
    });

    it('un mapa fusionado por número ya no es necesario: el índice por componente manda', () => {
        const netlist = buildNetlist(twoBoards(true), [Esp32Manifest, LedManifest]);
        const esp1 = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        const esp2 = new ArduinoCore({ manifest: Esp32Manifest, clock: () => 0 });
        drive(esp1, ARDUINO.LOW);
        drive(esp2, ARDUINO.HIGH);

        // Aunque las dos placas tengan el mismo GPIO 2, cada elemento usa el suyo
        const sol = solve(netlist, collect({ esp1, esp2 }));
        expect(sol.elementResults['led1:d1'].conducting).toBe(false);
        expect(sol.elementResults['led2:d1'].conducting).toBe(true);

        // Los netlist elements saben a qué componente pertenecen
        const gpio2 = netlist.elements.find((e) => e.id === 'esp2:gpio_2')!;
        expect(gpio2.componentId).toBe('esp2');
    });

    it('las tierras de ambas placas quedan a 0 V', () => {
        const netlist = buildNetlist(twoBoards(false), [Esp32Manifest, LedManifest]);
        const sol = solve(netlist);
        const gndNets = netlist.elements
            .filter((e) => e.primitive === 'groundRef')
            .map((e) => e.terminals.pin);
        expect(gndNets).toHaveLength(2);
        for (const net of gndNets) {
            expect(sol.nodeVoltages[net]).toBe(0);
        }
    });

    it.each(['3v3', 'vin'] as const)(
        'compartir el riel %s entre dos placas converge (fuentes idénticas deduplicadas)',
        (rail) => {
            const projection = twoBoards(true);
            projection.wires.push({
                id: 'rail',
                from: { componentId: 'esp1', pinId: rail },
                to: { componentId: 'esp2', pinId: rail },
            });

            const netlist = buildNetlist(projection, [Esp32Manifest, LedManifest]);
            const sol = solve(netlist);

            expect(sol.converged).toBe(true);
            expect(sol.diagnostics).toEqual([]);

            // El riel compartido queda en su tensión nominal (± caída por Rout)
            const net = netlist.elements.find((e) => e.id === `esp1:vcc_${rail === 'vin' ? '5v' : '3v3'}`)!
                .terminals.positive;
            expect(sol.nodeVoltages[net]).toBeCloseTo(rail === 'vin' ? 5.0 : 3.3, 2);
        },
    );
});
