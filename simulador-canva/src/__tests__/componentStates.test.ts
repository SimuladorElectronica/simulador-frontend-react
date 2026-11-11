import { describe, it, expect, beforeEach } from 'vitest';
import type { ComponentManifest, SimulationProjection } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { buildNetlist, solve } from '@core/solver';
import { deriveComponentStates } from '@core/runtime/componentStates';
import { applyBehaviors, setComponentInput } from '@core/runtime/componentBehavior';
import { Esp32Manifest, LedManifest, Dht11Manifest, PushbuttonManifest, RelayManifest } from '@core/manifests';

function projection(
    components: Array<{ id: string; type: string; params?: Record<string, number> }>,
    wires: Array<[string, string, string, string]> = [],
): SimulationProjection {
    return {
        components: components.map((c) => ({ id: c.id, type: c.type, params: c.params ?? {} })),
        wires: wires.map(([fc, fp, tc, tp], i) => ({
            id: `w${i}`,
            from: { componentId: fc, pinId: fp },
            to: { componentId: tc, pinId: tp },
        })),
        programs: [],
    };
}

const allManifests = (): ComponentManifest[] => [
    Esp32Manifest,
    LedManifest,
    Dht11Manifest,
    PushbuttonManifest,
    RelayManifest,
];

describe('deriveComponentStates (observables por componente)', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    it('publica brillo/encendido del LED a partir de la solución eléctrica', () => {
        const proj = projection(
            [
                { id: 'esp', type: Esp32Manifest.id },
                { id: 'led1', type: LedManifest.id },
            ],
            [
                ['esp', '3v3', 'led1', 'anode'],
                ['led1', 'cathode', 'esp', 'gnd1'],
            ],
        );
        const netlist = buildNetlist(proj, allManifests());
        const solution = solve(netlist);

        const states = deriveComponentStates({
            components: [{ id: 'led1', type: LedManifest.id, params: {} }],
            manifests: allManifests(),
            netlist,
            solution,
            inputs: new Map(),
        });

        const led = states.led1;
        expect(led).toBeDefined();
        expect(led.on).toBe(true);
        expect(led.brightness).toBeGreaterThan(0);
        expect(led.brightness).toBeLessThanOrEqual(1);
        expect(led.burned).toBe(false);
        // La clave es el componentId SIN ':' (los elementos usan 'comp:elem')
        expect(Object.keys(states)).toEqual(['led1']);
    });

    it('fusiona las entradas de INTERACT sobre lo derivado', () => {
        const proj = projection([{ id: 'dht', type: Dht11Manifest.id }]);
        const netlist = buildNetlist(proj, allManifests());
        const solution = solve(netlist);

        const states = deriveComponentStates({
            components: [{ id: 'dht', type: Dht11Manifest.id, params: {} }],
            manifests: allManifests(),
            netlist,
            solution,
            inputs: new Map([['dht', { temperature: 42, humidity: 80 }]]),
        });

        expect(states.dht.temperature).toBe(42);
        expect(states.dht.humidity).toBe(80);
    });

    it('marca `energized` cuando la bobina del relé supera el umbral', () => {
        const proj = projection(
            [
                { id: 'esp', type: Esp32Manifest.id },
                { id: 'rly', type: RelayManifest.id },
            ],
            [
                ['rly', 'coil+', 'esp', '3v3'],
                ['rly', 'coil-', 'esp', 'gnd1'],
            ],
        );
        const netlist = buildNetlist(proj, allManifests());
        const solution = solve(netlist);

        const states = deriveComponentStates({
            components: [{ id: 'rly', type: RelayManifest.id, params: {} }],
            manifests: allManifests(),
            netlist,
            solution,
            inputs: new Map(),
        });

        expect(states.rly.energized).toBe(true);
    });
});

describe('setComponentInput (INTERACT hacia el netlist)', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    it('escribe parámetros eléctricos, los persiste y avisa de que hay que re-resolver', () => {
        const proj = projection([{ id: 'btn', type: PushbuttonManifest.id }]);
        const netlist = buildNetlist(proj, allManifests());
        const inputs = new Map<string, Record<string, unknown>>();

        const changed = setComponentInput(netlist, 'btn', 'closed', true, inputs);

        expect(changed).toBe(true);
        const element = netlist.elements.find((e) => e.id === 'btn:sw1');
        expect(element!.params.closed).toBe(1);
        // Persistida: sobrevive a LOAD_CIRCUIT/RESET
        expect(inputs.get('btn')).toEqual({ closed: true });
    });

    it('las entradas NO eléctricas se persisten pero no obligan a re-resolver', () => {
        const proj = projection([{ id: 'dht', type: Dht11Manifest.id }]);
        const netlist = buildNetlist(proj, allManifests());
        const inputs = new Map<string, Record<string, unknown>>();

        const changed = setComponentInput(netlist, 'dht', 'temperature', 42, inputs);

        expect(changed).toBe(false);
        expect(inputs.get('dht')).toEqual({ temperature: 42 });
    });

    it('sin netlist sigue persistiendo la entrada', () => {
        const inputs = new Map<string, Record<string, unknown>>();
        expect(setComponentInput(null, 'x', 'distance', 120, inputs)).toBe(false);
        expect(inputs.get('x')).toEqual({ distance: 120 });
    });
});

describe('applyBehaviors (relé: bobina → contactos)', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    it('cierra NO y abre NC cuando la bobina está energizada (y avisa del cambio)', () => {
        const proj = projection(
            [
                { id: 'esp', type: Esp32Manifest.id },
                { id: 'rly', type: RelayManifest.id },
            ],
            [
                ['rly', 'coil+', 'esp', '3v3'],
                ['rly', 'coil-', 'esp', 'gnd1'],
            ],
        );
        const netlist = buildNetlist(proj, allManifests());
        const solution = solve(netlist);

        const changed = applyBehaviors(
            netlist,
            [{ id: 'rly', type: RelayManifest.id }],
            allManifests(),
            solution,
        );

        expect(changed).toBe(true);
        expect(netlist.elements.find((e) => e.id === 'rly:sw_no')!.params.closed).toBe(1);
        expect(netlist.elements.find((e) => e.id === 'rly:sw_nc')!.params.closed).toBe(0);
    });

    it('no cambia nada con la bobina sin alimentar', () => {
        const proj = projection([{ id: 'rly', type: RelayManifest.id }]);
        const netlist = buildNetlist(proj, allManifests());
        const solution = solve(netlist);

        const changed = applyBehaviors(
            netlist,
            [{ id: 'rly', type: RelayManifest.id }],
            allManifests(),
            solution,
        );

        expect(changed).toBe(false);
        expect(netlist.elements.find((e) => e.id === 'rly:sw_no')!.params.closed).toBe(0);
        expect(netlist.elements.find((e) => e.id === 'rly:sw_nc')!.params.closed).toBe(1);
    });
});
