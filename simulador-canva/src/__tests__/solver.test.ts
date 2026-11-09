import { describe, it, expect, beforeEach } from 'vitest';
import type { SimulationProjection, ComponentManifest } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { buildNetlist, solve } from '@core/solver';
import { LedManifest, Esp32Manifest } from '@core/manifests';

function manifestArray(...manifests: ComponentManifest[]): ComponentManifest[] {
    return manifests;
}

function makeProjection(
    components: Array<{ id: string; type: string; params?: Record<string, number> }>,
    wires: Array<{ from: { componentId: string; pinId: string }; to: { componentId: string; pinId: string } }>,
): SimulationProjection {
    return {
        components: components.map((c) => ({ id: c.id, type: c.type, params: c.params ?? {} })),
        wires: wires.map((w) => ({ id: `w_${w.from.componentId}_${w.from.pinId}_${w.to.componentId}_${w.to.pinId}`, from: w.from, to: w.to })),
        programs: [],
    };
}

describe('Solver eléctrico (Contrato 5)', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    describe('buildNetlist', () => {
        it('debe construir nets y elements a partir de una proyección simple', () => {
            const projection = makeProjection(
                [
                    { id: 'v1', type: 'core/esp32@1', params: {} },
                    { id: 'r1', type: 'core/led@1', params: {} },
                ],
                [
                    { from: { componentId: 'v1', pinId: '3v3' }, to: { componentId: 'r1', pinId: 'anode' } },
                    { from: { componentId: 'r1', pinId: 'cathode' }, to: { componentId: 'v1', pinId: 'gnd1' } },
                ],
            );

            const netlist = buildNetlist(projection, manifestArray(Esp32Manifest, LedManifest));

            expect(netlist.nets.length).toBeGreaterThan(0);
            expect(netlist.elements.length).toBeGreaterThan(0);

            const vcc = netlist.elements.find((e) => e.id === 'v1:vcc_3v3');
            expect(vcc).toBeDefined();
            expect(vcc!.primitive).toBe('voltageSource');

            const led = netlist.elements.find((e) => e.id === 'r1:d1');
            expect(led).toBeDefined();
            expect(led!.primitive).toBe('led');
        });

        it('debe fusionar pines equipotenciales vía internalGroups', () => {
            const projection = makeProjection(
                [{ id: 'esp', type: 'core/esp32@1', params: {} }],
                [],
            );

            const netlist = buildNetlist(projection, manifestArray(Esp32Manifest));

            const gnd1Pin = netlist.nets.find((n) => n.pins.some((p) => p.componentId === 'esp' && p.pinId === 'gnd1'));
            const gnd2Pin = netlist.nets.find((n) => n.pins.some((p) => p.componentId === 'esp' && p.pinId === 'gnd2'));

            expect(gnd1Pin).toBeDefined();
            expect(gnd2Pin).toBeDefined();
            expect(gnd1Pin!.id).toBe(gnd2Pin!.id);
        });

        it('debe ignorar componentes sin manifiesto registrado', () => {
            const projection = makeProjection(
                [{ id: 'x', type: 'unknown/type@1', params: {} }],
                [],
            );

            const netlist = buildNetlist(projection, manifestArray(LedManifest));
            expect(netlist.elements.length).toBe(0);
            expect(netlist.nets.length).toBe(0);
        });
    });

    describe('solve - circuitos lineales', () => {
        it('debe resolver una fuente de voltaje con LED a tierra (divisor simple)', () => {
            const projection = makeProjection(
                [
                    { id: 'esp', type: 'core/esp32@1', params: {} },
                    { id: 'led1', type: 'core/led@1', params: {} },
                ],
                [
                    { from: { componentId: 'esp', pinId: '3v3' }, to: { componentId: 'led1', pinId: 'anode' } },
                    { from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp', pinId: 'gnd1' } },
                ],
            );

            const netlist = buildNetlist(projection, manifestArray(Esp32Manifest, LedManifest));
            const solution = solve(netlist);

            expect(solution.converged).toBe(true);
            expect(solution.diagnostics).not.toContain('singular');
            expect(solution.diagnostics).not.toContain('noConvergence');

            const net3v3 = netlist.nets.find((n) =>
                n.pins.some((p) => p.componentId === 'esp' && p.pinId === '3v3')
            );
            expect(net3v3).toBeDefined();

            const v3v3 = solution.nodeVoltages[net3v3!.id];
            expect(v3v3).toBeGreaterThan(0);
            expect(v3v3).toBeCloseTo(3.3, 5);

            const ledElem = netlist.elements.find((e) => e.id === 'led1:d1');
            expect(ledElem).toBeDefined();
            const ledResult = solution.elementResults[ledElem!.id];
            expect(ledResult).toBeDefined();
            expect(ledResult!.voltage).toBeGreaterThan(0);
        });

        it('debe detectar cortocircuito entre fuente y tierra directamente', () => {
            const projection = makeProjection(
                [{ id: 'esp', type: 'core/esp32@1', params: {} }],
                [
                    { from: { componentId: 'esp', pinId: '3v3' }, to: { componentId: 'esp', pinId: 'gnd1' } },
                ],
            );

            const netlist = buildNetlist(projection, manifestArray(Esp32Manifest));
            const solution = solve(netlist);

            expect(solution.converged).toBe(false);
            expect(
                solution.diagnostics.includes('singular') ||
                solution.diagnostics.includes('noConvergence') ||
                solution.diagnostics.includes('shortCircuit')
            ).toBe(true);
        });

        it('debe manejar un circuito sin componentes (vacuo)', () => {
            const projection: SimulationProjection = { components: [], wires: [], programs: [] };
            const netlist = buildNetlist(projection, manifestArray(LedManifest));
            const solution = solve(netlist);

            expect(solution.converged).toBe(true);
            expect(solution.nodeVoltages).toEqual({});
            expect(solution.iterations).toBe(0);
        });
    });

    describe('solve - circuito sintético: fuente + ground + LED', () => {
        it('debe resolver una fuente de 3.3V con LED a tierra', () => {
            const testManifest: ComponentManifest = {
                id: 'test/simple-led@1',
                schemaVersion: 1,
                version: '1.0.0',
                displayName: 'Simple LED Test',
                category: 'test',
                size: { width: 10, height: 10 },
                art: '<svg/>',
                pins: [
                    { id: 'pos', label: '+', position: { x: 0, y: 0 }, kind: 'power' },
                    { id: 'neg', label: '-', position: { x: 0, y: 10 }, kind: 'ground' },
                    { id: 'gnd', label: 'GND', position: { x: 0, y: 20 }, kind: 'ground' },
                    { id: 'a', label: 'A', position: { x: 0, y: 30 }, kind: 'passive' },
                    { id: 'k', label: 'K', position: { x: 0, y: 40 }, kind: 'passive' },
                ],
                internalGroups: [['neg', 'gnd']],
                elements: [
                    {
                        id: 'vs1',
                        primitive: 'voltageSource',
                        ports: { positive: 'pos', negative: 'neg' },
                        params: { voltage: 3.3, outputResistance: 0.1 },
                    },
                    {
                        id: 'gr1',
                        primitive: 'groundRef',
                        ports: { pin: 'gnd' },
                        params: {},
                    },
                    {
                        id: 'led1',
                        primitive: 'led',
                        ports: { anode: 'a', cathode: 'k' },
                        params: { forwardVoltage: 1.8, seriesResistance: 10 },
                    },
                ],
            };

            const projection = makeProjection(
                [{ id: 'src', type: 'test/simple-led@1', params: {} }],
                [
                    { from: { componentId: 'src', pinId: 'pos' }, to: { componentId: 'src', pinId: 'a' } },
                    { from: { componentId: 'src', pinId: 'k' }, to: { componentId: 'src', pinId: 'neg' } },
                ],
            );

            const netlist = buildNetlist(projection, [testManifest]);
            const solution = solve(netlist);

            expect(solution.converged).toBe(true);
            expect(solution.diagnostics).not.toContain('singular');

            const ledResult = solution.elementResults['src:led1'];
            expect(ledResult).toBeDefined();
            expect(ledResult!.conducting).toBe(true);
        });
    });

    describe('solve - circuito sintético simple (fuente + resistor)', () => {
        it('debe resolver una fuente de 5V con un resistor de 1000 ohm a tierra', () => {
            const testManifest: ComponentManifest = {
                id: 'test/simple@1',
                schemaVersion: 1,
                version: '1.0.0',
                displayName: 'Simple Test',
                category: 'test',
                size: { width: 10, height: 10 },
                art: '<svg/>',
                pins: [
                    { id: 'pos', label: '+', position: { x: 0, y: 0 }, kind: 'power' },
                    { id: 'neg', label: '-', position: { x: 0, y: 10 }, kind: 'ground' },
                    { id: 'gnd', label: 'GND', position: { x: 0, y: 20 }, kind: 'ground' },
                ],
                internalGroups: [['neg', 'gnd']],
                elements: [
                    {
                        id: 'vs1',
                        primitive: 'voltageSource',
                        ports: { positive: 'pos', negative: 'neg' },
                        params: { voltage: 5.0, outputResistance: 0 },
                    },
                    {
                        id: 'gr1',
                        primitive: 'groundRef',
                        ports: { pin: 'gnd' },
                        params: {},
                    },
                ],
            };

            const testManifest2: ComponentManifest = {
                id: 'test/resistor@1',
                schemaVersion: 1,
                version: '1.0.0',
                displayName: 'Resistor',
                category: 'test',
                size: { width: 10, height: 10 },
                art: '<svg/>',
                pins: [
                    { id: 'a', label: 'A', position: { x: 0, y: 0 }, kind: 'passive' },
                    { id: 'b', label: 'B', position: { x: 0, y: 10 }, kind: 'passive' },
                ],
                elements: [
                    {
                        id: 'r1',
                        primitive: 'resistor',
                        ports: { a: 'a', b: 'b' },
                        params: { resistance: 1000 },
                    },
                ],
            };

            const projection = makeProjection(
                [
                    { id: 'src', type: 'test/simple@1', params: {} },
                    { id: 'r1', type: 'test/resistor@1', params: {} },
                ],
                [
                    { from: { componentId: 'src', pinId: 'pos' }, to: { componentId: 'r1', pinId: 'a' } },
                    { from: { componentId: 'r1', pinId: 'b' }, to: { componentId: 'src', pinId: 'neg' } },
                ],
            );

            const netlist = buildNetlist(projection, [testManifest, testManifest2]);
            const solution = solve(netlist);

            expect(solution.converged).toBe(true);
            expect(solution.diagnostics).not.toContain('singular');

            const netPos = netlist.nets.find((n) =>
                n.pins.some((p) => p.componentId === 'src' && p.pinId === 'pos')
            );
            expect(netPos).toBeDefined();
            const vPos = solution.nodeVoltages[netPos!.id];
            expect(vPos).toBeCloseTo(5.0, 1);
        });
    });

    describe('solve - LED no lineal (Newton-Raphson)', () => {
        it('debe converger para un LED polarizado en adelante', () => {
            const projection = makeProjection(
                [
                    { id: 'esp', type: 'core/esp32@1', params: {} },
                    { id: 'led1', type: 'core/led@1', params: {} },
                ],
                [
                    { from: { componentId: 'esp', pinId: '3v3' }, to: { componentId: 'led1', pinId: 'anode' } },
                    { from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp', pinId: 'gnd1' } },
                ],
            );

            const netlist = buildNetlist(projection, manifestArray(Esp32Manifest, LedManifest));
            const solution = solve(netlist);

            expect(solution.converged).toBe(true);
            expect(solution.iterations).toBeGreaterThan(0);
            expect(solution.iterations).toBeLessThanOrEqual(50);

            const ledResult = solution.elementResults['led1:d1'];
            expect(ledResult).toBeDefined();
            expect(ledResult!.conducting).toBe(true);
            expect(ledResult!.voltage).toBeGreaterThan(1.5);

            // La fuente de 3.3V debe reportar la corriente que entrega (~0.15A al LED
            // + ~0.8mA de los pull-down internos de los GPIO), no ~0
            // (antes se aproximaba como (V - Vfuente)/Rout).
            const srcResult = solution.elementResults['esp:vcc_3v3'];
            expect(srcResult).toBeDefined();
            expect(srcResult!.voltage).toBeCloseTo(3.3, 5);
            expect(srcResult!.current).toBeGreaterThanOrEqual(ledResult!.current);
            expect(srcResult!.current - ledResult!.current).toBeLessThan(0.001);
            expect(srcResult!.current).toBeCloseTo(0.15, 2);
        });

        it('debe reportar LED no conduciendo si la tensión es insuficiente', () => {
            const projection = makeProjection(
                [
                    { id: 'esp', type: 'core/esp32@1', params: {} },
                    { id: 'led1', type: 'core/led@1', params: {} },
                ],
                [
                    { from: { componentId: 'esp', pinId: 'gnd1' }, to: { componentId: 'led1', pinId: 'anode' } },
                    { from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp', pinId: 'gnd1' } },
                ],
            );

            const netlist = buildNetlist(projection, manifestArray(Esp32Manifest, LedManifest));
            const solution = solve(netlist);

            expect(solution.converged).toBe(true);

            const ledResult = solution.elementResults['led1:d1'];
            expect(ledResult).toBeDefined();
            expect(ledResult!.conducting).toBe(false);
            expect(ledResult!.current).toBeCloseTo(0, 2);
        });
    });

    describe('SolverSolution tipo', () => {
        it('debe tener la forma esperada de SolverSolution', () => {
            const projection = makeProjection(
                [
                    { id: 'esp', type: 'core/esp32@1', params: {} },
                    { id: 'led1', type: 'core/led@1', params: {} },
                ],
                [
                    { from: { componentId: 'esp', pinId: '3v3' }, to: { componentId: 'led1', pinId: 'anode' } },
                    { from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp', pinId: 'gnd1' } },
                ],
            );

            const netlist = buildNetlist(projection, manifestArray(Esp32Manifest, LedManifest));
            const solution = solve(netlist);

            expect(typeof solution.converged).toBe('boolean');
            expect(typeof solution.iterations).toBe('number');
            expect(Array.isArray(solution.diagnostics)).toBe(true);
            for (const d of solution.diagnostics) {
                expect(['shortCircuit', 'floatingIsland', 'singular', 'noConvergence']).toContain(d);
            }
            for (const [netId, v] of Object.entries(solution.nodeVoltages)) {
                expect(typeof netId).toBe('string');
                expect(typeof v).toBe('number');
            }
            for (const [elemId, r] of Object.entries(solution.elementResults)) {
                expect(typeof elemId).toBe('string');
                expect(typeof (r as { voltage: number }).voltage).toBe('number');
                expect(typeof (r as { current: number }).current).toBe('number');
                expect(typeof (r as { power: number }).power).toBe('number');
            }
        });
    });
});
