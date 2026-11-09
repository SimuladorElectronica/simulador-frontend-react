import { describe, it, expect } from 'vitest';
import { evaluateMonitors, createMonitorStates } from '@core/solver';
import type { MonitorStates } from '@core/solver';
import { LedManifest } from '@core/manifests';
import type { ComponentManifest, SolverSolution } from '@types';

/** Componente mínimo con el manifiesto real del LED (monitor de 60 mW / 1.5 s) */
const LED_COMPONENT = { id: 'salidas_1', type: 'core/led@1' };

function resultsFor(power: number): SolverSolution['elementResults'] {
    return {
        'salidas_1:d1': { voltage: 2.1, current: power / 2.1, power },
    };
}

/** Manifiesto sintético para cubrir comparison:'below' + scope:'component' */
const MCU_MANIFEST: ComponentManifest = {
    id: 'test/mcu@1',
    schemaVersion: 1,
    version: '1.0.0',
    displayName: 'MCU de prueba',
    category: 'test',
    mcu: { platform: 'esp32@1' },
    size: { width: 10, height: 10 },
    art: '<svg/>',
    pins: [
        { id: 'rail', label: 'V', position: { x: 0, y: 0 }, kind: 'power' },
        { id: 'gnd', label: 'G', position: { x: 0, y: 10 }, kind: 'ground' },
    ],
    elements: [
        {
            id: 'rail',
            primitive: 'voltageSource',
            ports: { positive: 'rail', negative: 'gnd' },
            params: { voltage: 3.3 },
        },
    ],
    monitors: [
        {
            element: 'rail',
            quantity: 'voltage',
            comparison: 'below',
            limit: 2.8,
            duration: 10_000,
            event: 'BROWNOUT_RESET',
            action: 'reset',
            scope: 'component',
        },
    ],
};

function evaluate(
    states: MonitorStates,
    at: number,
    elementResults: SolverSolution['elementResults'],
    components = [LED_COMPONENT],
    manifests: ComponentManifest[] = [LedManifest],
) {
    return evaluateMonitors({
        components,
        manifests,
        elementResults,
        virtualTimeUs: at,
        states,
    });
}

describe('Motor de monitores (daño / brownout)', () => {
    it('no se dispara antes de cumplir duration y dispara exactamente al cumplirlo', () => {
        const states = createMonitorStates();
        const overPower = resultsFor(0.063); // 63 mW > límite de 60 mW

        expect(evaluate(states, 0, overPower)).toHaveLength(0);
        expect(evaluate(states, 1_499_000, overPower)).toHaveLength(0);
        expect(evaluate(states, 1_500_000, overPower)).toHaveLength(1);
    });

    it('emite una sola vez por episodio y se rearma cuando la condición se acaba', () => {
        const states = createMonitorStates();
        const hot = resultsFor(0.063);

        expect(evaluate(states, 0, hot)).toHaveLength(0);
        expect(evaluate(states, 2_000_000, hot)).toHaveLength(1);
        // Sigue sobre el límite: no vuelve a emitir
        expect(evaluate(states, 3_000_000, hot)).toHaveLength(0);
        expect(evaluate(states, 4_000_000, hot)).toHaveLength(0);

        // Baja del límite → rearma
        const cold = resultsFor(0.01);
        expect(evaluate(states, 5_000_000, cold)).toHaveLength(0);

        // Un nuevo episodio vuelve a exigir la duración completa
        expect(evaluate(states, 5_100_000, hot)).toHaveLength(0);
        expect(evaluate(states, 6_600_000, hot)).toHaveLength(1);
    });

    it('acumula la duración aunque el valor no cambie (condición sostenida sin re-solve)', () => {
        const states = createMonitorStates();
        const hot = resultsFor(0.063);
        let fired = 0;
        // 1.5 s en pasos de 10 ms: solo el último tick debe emitir
        for (let t = 0; t <= 1_510_000; t += 10_000) {
            fired += evaluate(states, t, hot).length;
        }
        expect(fired).toBe(1);
    });

    it('soporta comparison "below" y scope "component" (BROWNOUT_RESET)', () => {
        const states = createMonitorStates();
        const components = [{ id: 'microcontroladores_2', type: 'test/mcu@1' }];
        const manifests = [MCU_MANIFEST];
        const sagged: SolverSolution['elementResults'] = {
            'microcontroladores_2:rail': { voltage: 2.5, current: 0.5, power: 1.25 },
        };

        expect(evaluate(states, 0, sagged, components, manifests)).toHaveLength(0);
        const [ev] = evaluate(states, 10_000, sagged, components, manifests);
        expect(ev).toBeDefined();
        expect(ev!.event).toBe('BROWNOUT_RESET');
        expect(ev!.action).toBe('reset');
        expect(ev!.sourceId).toBe('microcontroladores_2'); // scope: component
        expect(ev!.value).toBe(2.5);

        // Riel recuperado → rearma
        const healthy: SolverSolution['elementResults'] = {
            'microcontroladores_2:rail': { voltage: 3.3, current: 0, power: 0 },
        };
        expect(evaluate(states, 20_000, healthy, components, manifests)).toHaveLength(0);
        expect(evaluate(states, 30_000, sagged, components, manifests)).toHaveLength(0); // desde 30_000
        expect(evaluate(states, 40_000, sagged, components, manifests)).toHaveLength(1);
    });

    it('scope "element" (por omisión) emite contra el elemento y respeta los manifiestos', () => {
        const states = createMonitorStates();
        evaluate(states, 0, resultsFor(0.063));
        const [ev] = evaluate(states, 1_500_000, resultsFor(0.063));
        expect(ev).toBeDefined();
        expect(ev!.event).toBe('COMPONENT_BURNED');
        expect(ev!.sourceId).toBe('salidas_1:d1');
        expect(ev!.elementId).toBe('salidas_1:d1');

        // Componente sin monitores / sin resultado → nada que evaluar
        expect(evaluate(states, 0, {}, [{ id: 'x', type: 'core/led@1' }])).toHaveLength(0);
        expect(evaluate(states, 0, {}, [{ id: 'x', type: 'desconocido@1' }])).toHaveLength(0);
    });
});
