import { describe, it, expect } from 'vitest';
import type { VisualRule } from '@types';
import {
    applyVisualRules,
    formatOhms,
    mapObservable,
    resistorBandColors,
} from '../UIcomponents/utils/visualRules';

const rule = (partial: Partial<VisualRule>): VisualRule => ({
    observable: 'value',
    property: 'fill',
    mapping: { type: 'value' },
    ...partial,
});

describe('formatOhms', () => {
    it('abrevia kΩ, MΩ y GΩ', () => {
        expect(formatOhms(220)).toBe('220Ω');
        expect(formatOhms(4700)).toBe('4.7kΩ');
        expect(formatOhms(100_000)).toBe('100kΩ');
        expect(formatOhms(1_000_000)).toBe('1MΩ');
        expect(formatOhms(100_000_000)).toBe('100MΩ');
        expect(formatOhms(1_000_000_000)).toBe('1GΩ');
    });
});

describe('resistorBandColors', () => {
    it('traduce el valor a las 4 bandas (2 cifras, multiplicador, tolerancia)', () => {
        expect(resistorBandColors(220)).toEqual(['#e74c3c', '#e74c3c', '#8d5a2b', '#ffd700']); // rojo rojo marrón
        expect(resistorBandColors(4700)).toEqual(['#f1c40f', '#9b59b6', '#e74c3c', '#ffd700']); // amarillo violeta rojo
        expect(resistorBandColors(100_000)).toEqual(['#8d5a2b', '#000000', '#f1c40f', '#ffd700']); // marrón negro amarillo
    });

    it('devuelve vacío para valores no positivos o fuera de escala', () => {
        expect(resistorBandColors(0)).toEqual([]);
        expect(resistorBandColors(-10)).toEqual([]);
        expect(resistorBandColors(Number.NaN)).toEqual([]);
    });
});

describe('mapObservable', () => {
    it('discrete: busca por String(valor)', () => {
        const mapping = { type: 'discrete' as const, values: { true: '#2ecc71', false: '#7f8c8d' } };
        expect(mapObservable(mapping, true)).toBe('#2ecc71');
        expect(mapObservable(mapping, false)).toBe('#7f8c8d');
        expect(mapObservable(mapping, undefined)).toBeNull();
    });

    it('linear: interpola y acota al rango destino', () => {
        const mapping = { type: 'linear' as const, min: 0, max: 0.6 };
        expect(mapObservable(mapping, 0)).toBe(0);
        expect(mapObservable(mapping, 0.5)).toBeCloseTo(0.3, 6);
        expect(mapObservable(mapping, 1)).toBe(0.6);
        // Fuera de rango → acotado (nunca un opacity > 1)
        expect(mapObservable(mapping, 5)).toBe(0.6);
        expect(mapObservable(mapping, -5)).toBe(0);
        expect(mapObservable(mapping, 'x')).toBeNull();
    });

    it('text: formatea con sufijo y con formato ohms', () => {
        expect(mapObservable({ type: 'text', decimals: 0, suffix: '°' }, 90)).toBe('90°');
        expect(mapObservable({ type: 'text', format: 'ohms' }, 4700)).toBe('4.7kΩ');
    });

    it('rotate: genera el transform con el centro declarado', () => {
        const mapping = {
            type: 'rotate' as const,
            centerX: 35,
            centerY: 34,
            from: -135,
            to: 135,
            sourceMin: 0,
            sourceMax: 1,
        };
        expect(mapObservable(mapping, 0)).toBe('rotate(-135 35 34)');
        expect(mapObservable(mapping, 0.5)).toBe('rotate(0 35 34)');
        expect(mapObservable(mapping, 1)).toBe('rotate(135 35 34)');
    });

    it('value: los números se redondean y el resto se stringifica', () => {
        expect(mapObservable({ type: 'value' }, '#e74c3c')).toBe('#e74c3c');
        expect(mapObservable({ type: 'value' }, 3.333333333)).toBe(3.3333);
    });
});

describe('applyVisualRules', () => {
    const art = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
  <rect id="lamp" x="0" y="0" width="10" height="10" fill="#111111" opacity="1"/>
  <text id="label" x="5" y="20">original</text>
  <g id="bands"><rect x="0" y="0" width="1" height="1" fill="#000"/></g>
</svg>`;

    it('reescribe un atributo del elemento objetivo', () => {
        const out = applyVisualRules(art, [rule({ observable: 'color', targetId: 'lamp' })], {
            color: '#ff0000',
        });
        expect(out).toContain('fill="#ff0000"');
        expect(out).toContain('fill="#000"'); // los demás elementos no se tocan
    });

    it('sobreescribe un atributo ya existente (sin duplicarlo)', () => {
        const out = applyVisualRules(art, [rule({ observable: 'color', targetId: 'lamp' })], {
            color: '#00ff00',
        });
        expect(out.match(/fill="#00ff00"/g)).toHaveLength(1);
        expect(out).not.toContain('fill="#111111"');
    });

    it('property=text reemplaza el contenido y escapa XML', () => {
        const out = applyVisualRules(
            art,
            [rule({ observable: 'line', property: 'text', targetId: 'label' })],
            { line: '<hola & adiós>' },
        );
        expect(out).toContain('<text id="label" x="5" y="20">&lt;hola &amp; adiós&gt;</text>');
        expect(out).not.toContain('original');
    });

    it('property=content con bands genera las bandas dentro del <g>', () => {
        const out = applyVisualRules(
            art,
            [
                rule({
                    observable: 'resistance',
                    property: 'content',
                    targetId: 'bands',
                    mapping: { type: 'bands', startX: 31, startY: 9, width: 5, height: 22, pitch: 9 },
                }),
            ],
            { resistance: 220 },
        );
        expect(out).toContain('<rect x="31" y="9"');
        expect(out).toContain('<rect x="49" y="9"'); // cuarta banda
        expect(out).toContain('fill="#ffd700"');
        expect(out).not.toContain('fill="#000"/>'); // bandas originales fuera
    });

    it('ignora observables ausentes y conserva el arte original', () => {
        expect(applyVisualRules(art, [rule({ observable: 'missing', targetId: 'lamp' })], {})).toBe(art);
        expect(applyVisualRules(art, [rule({ observable: 'color', targetId: 'no-existe' })], { color: '#fff' })).toBe(art);
        expect(applyVisualRules(art, undefined, { color: '#fff' })).toBe(art);
    });

    it('las reglas se aplican en cadena (varios targets en el mismo arte)', () => {
        const out = applyVisualRules(
            art,
            [
                rule({ observable: 'color', targetId: 'lamp' }),
                rule({ observable: 'line', property: 'text', targetId: 'label' }),
            ],
            { color: '#abcdef', line: 'hola' },
        );
        expect(out).toContain('fill="#abcdef"');
        expect(out).toContain('>hola</text>');
    });
});
