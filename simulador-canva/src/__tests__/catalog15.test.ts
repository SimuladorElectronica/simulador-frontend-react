import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestRegistry, MVP_CATALOG } from '@core/registry/manifestRegistry';

/**
 * Issue 4.14 — el catálogo del MVP es una lista CERRADA de 15 componentes.
 * Estas pruebas fijan el catálogo y los invariantes que cumplen todos ellos
 * (SVG autocontenido con el tamaño declarado, reglas visuales apuntando a
 * elementos reales, parámetros e interacciones sin colisiones…).
 */
const SVG_ROOT = /<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/;

/** Componentes que declaran sliders de variables ambientales / de posición */
const WITH_SLIDERS = [
    'core/dht11@1',
    'core/hcsr04@1',
    'core/ldr@1',
    'core/potentiometer@1',
    'core/servo_sg90@1',
];

describe('Catálogo MVP: 15 componentes', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    it('define exactamente 15 manifiestos, con IDs únicos y registrados', () => {
        expect(MVP_CATALOG).toHaveLength(15);

        const ids = MVP_CATALOG.map((m) => m.id);
        expect(new Set(ids).size).toBe(15);

        for (const manifest of MVP_CATALOG) {
            expect(ManifestRegistry.get(manifest.id), manifest.id).toBe(manifest);
        }
        expect(ManifestRegistry.getAll()).toHaveLength(15);
    });

    it('todos pasan la validación del registro (pines, puertos y monitores)', () => {
        for (const manifest of MVP_CATALOG) {
            expect(() => ManifestRegistry.validate(manifest), manifest.id).not.toThrow();
            expect(manifest.pins.length, manifest.id).toBeGreaterThan(0);
        }
    });

    it('el arte es un SVG autocontenido con el tamaño declarado en `size`', () => {
        for (const manifest of MVP_CATALOG) {
            expect(manifest.art, manifest.id).toContain('<svg');
            expect(manifest.art, manifest.id).toContain('xmlns="http://www.w3.org/2000/svg"');

            const match = SVG_ROOT.exec(manifest.art);
            expect(match, `${manifest.id}: falta width/height en la raíz SVG`).not.toBeNull();
            expect(Number(match![1]), `${manifest.id}: width`).toBe(manifest.size.width);
            expect(Number(match![2]), `${manifest.id}: height`).toBe(manifest.size.height);
        }
    });

    it('cada regla visual apunta a un elemento del SVG y a un observable declarado', () => {
        for (const manifest of MVP_CATALOG) {
            const observables = new Set(manifest.observables ?? []);

            for (const rule of manifest.visualRules ?? []) {
                const target = rule.targetId ?? rule.mapping.targetId;
                const where = `${manifest.id} → ${rule.observable}`;

                expect(target, `${where}: falta targetId`).toBeDefined();
                expect(manifest.art, `${where}: no existe id="${target}"`).toContain(`id="${target}"`);
                expect(observables.has(rule.observable), `${where}: observable no declarado`).toBe(true);
            }
        }
    });

    it('los parámetros configurables y las interacciones no pisan sus nombres', () => {
        for (const manifest of MVP_CATALOG) {
            const names = new Set<string>();

            for (const key of Object.keys(manifest.parameters ?? {})) {
                expect(names.has(key), `${manifest.id}: nombre duplicado '${key}'`).toBe(false);
                names.add(key);
            }

            for (const interaction of manifest.interactions ?? []) {
                expect(names.has(interaction.name), `${manifest.id}: '${interaction.name}' ya existe`).toBe(false);
                names.add(interaction.name);
                expect(['click', 'drag', 'slider', 'press'], interaction.name).toContain(interaction.gesture);
            }
        }
    });

    it('la resistencia es UN manifiesto parametrizable (no uno por valor)', () => {
        const resistor = ManifestRegistry.get('core/resistor@1');
        expect(resistor).toBeDefined();
        expect(Object.keys(resistor!.parameters ?? {})).toContain('resistance');
        expect(resistor!.interactions ?? []).toHaveLength(0);
    });

    it('los sensores exponen sliders de variables ambientales', () => {
        for (const id of WITH_SLIDERS) {
            const manifest = ManifestRegistry.get(id);
            expect(manifest, id).toBeDefined();
            const sliders = (manifest!.interactions ?? []).filter((i) => i.gesture === 'slider');
            expect(sliders.length, `${id}: sin sliders`).toBeGreaterThan(0);
            for (const slider of sliders) {
                expect(slider.defaultValue, `${id}.${slider.name}`).toBeDefined();
                expect(slider.min, `${id}.${slider.name}`).toBeDefined();
                expect(slider.max, `${id}.${slider.name}`).toBeDefined();
            }
        }

        const button = ManifestRegistry.get('core/pushbutton@1');
        expect((button!.interactions ?? []).some((i) => i.gesture === 'press')).toBe(true);
    });
});
