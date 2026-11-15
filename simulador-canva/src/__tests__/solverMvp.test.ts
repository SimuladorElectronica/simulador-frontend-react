import { describe, it, expect, beforeEach } from 'vitest';
import type { SimulationProjection } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { buildNetlist, solve } from '@core/solver';
import { ldrResistance } from '@core/solver/electricalSolver';
import { Esp32Manifest, LdrManifest, PotentiometerManifest, ResistorManifest } from '@core/manifests';

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

describe('LDR: la resistencia depende de la iluminación', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    it('interpola entre la resistencia a oscuras y la plenamente iluminada', () => {
        expect(ldrResistance({ light: 0 })).toBe(1_000_000);
        expect(ldrResistance({ light: 100 })).toBe(300);
        expect(ldrResistance({ light: 50 })).toBe(500_150);
        // Sin `light` declarado usa el valor por defecto (50 %)
        expect(ldrResistance({})).toBe(500_150);
    });

    it('a más luz, más corriente por el mismo circuito', () => {
        const currentAt = (light: number) => {
            const proj = projection(
                [
                    { id: 'esp', type: Esp32Manifest.id },
                    { id: 'ldr', type: LdrManifest.id, params: { light } },
                ],
                [
                    ['ldr', 'a', 'esp', '3v3'],
                    ['ldr', 'b', 'esp', 'gnd1'],
                ],
            );
            const solution = solve(buildNetlist(proj, [Esp32Manifest, LdrManifest]));
            expect(solution.converged).toBe(true);
            return Math.abs(solution.elementResults['ldr:ldr1'].current);
        };

        const dark = currentAt(0);
        const bright = currentAt(100);

        expect(dark).toBeGreaterThan(0);
        expect(bright).toBeGreaterThan(dark * 1000);
    });
});

describe('Potenciómetro: el wiper sigue a la posición', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    const wiperVoltage = (position: number) => {
        const proj = projection(
            [
                { id: 'esp', type: Esp32Manifest.id },
                { id: 'pot', type: PotentiometerManifest.id, params: { position } },
            ],
            [
                ['pot', 'a', 'esp', '3v3'],
                ['pot', 'b', 'esp', 'gnd1'],
            ],
        );
        const netlist = buildNetlist(proj, [Esp32Manifest, PotentiometerManifest]);
        const solution = solve(netlist);
        expect(solution.converged).toBe(true);

        const wiperNet = netlist.nets.find((n) =>
            n.pins.some((p) => p.componentId === 'pot' && p.pinId === 'wiper'),
        );
        expect(wiperNet).toBeDefined();
        return solution.nodeVoltages[wiperNet!.id];
    };

    it('funciona como divisor: extremos completos a los dos extremos de la pista', () => {
        expect(wiperVoltage(0)).toBeCloseTo(3.3, 3); // wiper en `a`
        expect(wiperVoltage(1)).toBeCloseTo(0, 3); // wiper en `b`
        expect(wiperVoltage(0.5)).toBeCloseTo(1.65, 3); // punto medio
        expect(wiperVoltage(0.25)).toBeCloseTo(2.475, 3);
    });
});

describe('GMIN: un componente aislado no vuelve singular la matriz', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    it('resuelve una resistencia sin ningún cable conectado', () => {
        const proj = projection([{ id: 'r1', type: ResistorManifest.id, params: { resistance: 220 } }]);
        const netlist = buildNetlist(proj, [ResistorManifest]);
        const solution = solve(netlist);

        expect(solution.converged).toBe(true);
        expect(solution.diagnostics).not.toContain('singular');
        expect(solution.diagnostics).not.toContain('noConvergence');
        // Sin nada que la alimente, todo el mundo queda a 0 V
        for (const voltage of Object.values(solution.nodeVoltages)) {
            expect(Math.abs(voltage)).toBeLessThan(1e-6);
        }
    });

    it('una isla de varios componentes sin referencia también converge', () => {
        const proj = projection(
            [
                { id: 'r1', type: ResistorManifest.id, params: {} },
                { id: 'r2', type: ResistorManifest.id, params: {} },
            ],
            [['r1', 'b', 'r2', 'a']],
        );
        const solution = solve(buildNetlist(proj, [ResistorManifest]));

        expect(solution.converged).toBe(true);
        expect(solution.diagnostics).not.toContain('singular');
    });
});
