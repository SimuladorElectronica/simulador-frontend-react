import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { LedManifest, BreadboardManifest, Esp32Manifest } from '@core/manifests';
import type { ComponentManifest } from '@types';

describe('Pruebas de Contrato 2: Manifiestos de Componentes', () => {
    beforeEach(() => {
        ManifestRegistry.init();
    });

    // -------------------------------------------------------------------------
    // 1. Registro y Recuperación en el Catálogo
    // -------------------------------------------------------------------------
    describe('1. Registro y Catálogo Base', () => {
        it('debe registrar y recuperar los tres manifiestos base por su ID único', () => {
            const led = ManifestRegistry.get('core/led@1');
            const breadboard = ManifestRegistry.get('core/breadboard@1');
            const esp32 = ManifestRegistry.get('core/esp32@1');

            expect(led).toEqual(LedManifest);
            expect(breadboard).toEqual(BreadboardManifest);
            expect(esp32).toEqual(Esp32Manifest);
            expect(ManifestRegistry.getAll().length).toBe(3);
        });
    });

    // -------------------------------------------------------------------------
    // 2. Verificación Estructural del LED Manifest
    // -------------------------------------------------------------------------
    describe('2. Manifiesto del LED (core/led@1)', () => {
        it('debe pasar la validación y definir pines y elementos correctamente', () => {
            expect(() => ManifestRegistry.validate(LedManifest)).not.toThrow();

            expect(LedManifest.pins.map((p) => p.id)).toEqual(['anode', 'cathode']);
            expect(LedManifest.elements.length).toBe(1);

            const elem = LedManifest.elements[0];
            expect(elem.primitive).toBe('led');
            expect(elem.ports).toEqual({ anode: 'anode', cathode: 'cathode' });

            // Verificar monitor de potencia disipada
            expect(LedManifest.monitors).toBeDefined();
            expect(LedManifest.monitors![0].action).toBe('destroy');
            expect(LedManifest.monitors![0].limit).toBe(0.06); // 60 mW
        });
    });

    // -------------------------------------------------------------------------
    // 3. Verificación Estructural de la Protoboard Manifest
    // -------------------------------------------------------------------------
    describe('3. Manifiesto de la Protoboard (core/breadboard@1)', () => {
        it('debe generar las agrupaciones equipotenciales sin elementos eléctricos', () => {
            expect(() => ManifestRegistry.validate(BreadboardManifest)).not.toThrow();

            // 30 columnas x 5 filas = 150 pines centrales
            expect(BreadboardManifest.pins.length).toBe(150);
            expect(BreadboardManifest.elements.length).toBe(0);

            // Debe contener 30 grupos equipotenciales internos
            expect(BreadboardManifest.internalGroups).toBeDefined();
            expect(BreadboardManifest.internalGroups!.length).toBe(30);

            // Verificar que la columna 1 agrupa a1, b1, c1, d1, e1
            expect(BreadboardManifest.internalGroups![0]).toEqual(['a1', 'b1', 'c1', 'd1', 'e1']);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Verificación Estructural del ESP32 Manifest
    // -------------------------------------------------------------------------
    describe('4. Manifiesto de la ESP32 (core/esp32@1)', () => {
        it('debe declarar la plataforma MCU, los 30 pines y los elementos GPIO', () => {
            expect(() => ManifestRegistry.validate(Esp32Manifest)).not.toThrow();

            // Habilitación de plataforma MCU (Contrato 3)
            expect(Esp32Manifest.mcu).toEqual({ platform: 'esp32@1' });

            // Verificación de pines (30 pines)
            expect(Esp32Manifest.pins.length).toBe(30);

            // Verificar que los pines inputOnly estén bien tipados
            const gpio35 = Esp32Manifest.pins.find((p) => p.id === 'gpio35');
            expect(gpio35).toBeDefined();
            expect(gpio35?.gpio?.inputOnly).toBe(true);

            // Unión equipotencial de pines GND
            expect(Esp32Manifest.internalGroups).toEqual([['gnd1', 'gnd2']]);

            // Verificar presencia de fuentes fijas y primitivas GPIO
            const primitives = Esp32Manifest.elements.map((e) => e.primitive);
            expect(primitives).toContain('voltageSource');
            expect(primitives).toContain('groundRef');
            expect(primitives).toContain('gpio');

            // Verificar monitor de Brownout Reset
            const brownout = Esp32Manifest.monitors?.find((m) => m.event === 'BROWNOUT_RESET');
            expect(brownout).toBeDefined();
            expect(brownout?.action).toBe('reset');
            expect(brownout?.scope).toBe('component');
        });
    });

    // -------------------------------------------------------------------------
    // 5. Invariantes y Rechazo de Manifiestos Inválidos
    // -------------------------------------------------------------------------
    describe('5. Validación de Invariantes del Contrato 2', () => {
        it('debe rechazar un manifiesto con IDs de pines duplicados', () => {
            const invalidManifest: ComponentManifest = {
                ...LedManifest,
                id: 'test/duplicate-pins@1',
                pins: [
                    { id: 'anode', label: 'A1', position: { x: 0, y: 0 }, kind: 'passive' },
                    { id: 'anode', label: 'A2', position: { x: 10, y: 10 }, kind: 'passive' }, // Duplicado
                ],
            };

            expect(() => ManifestRegistry.validate(invalidManifest)).toThrow(/Pin duplicado 'anode'/);
        });

        it('debe rechazar conexiones internas que apunten a pines inexistentes', () => {
            const invalidManifest: ComponentManifest = {
                ...BreadboardManifest,
                id: 'test/invalid-internal-group@1',
                internalGroups: [['a1', 'pin_fantasma']], // 'pin_fantasma' no existe
            };

            expect(() => ManifestRegistry.validate(invalidManifest)).toThrow(/Grupo interno referencia pin inexistente 'pin_fantasma'/);
        });

        it('debe rechazar elementos cuyo puerto apunte a un pin inexistente', () => {
            const invalidManifest: ComponentManifest = {
                ...LedManifest,
                id: 'test/invalid-element-port@1',
                elements: [
                    {
                        id: 'd1',
                        primitive: 'led',
                        ports: { anode: 'anode', cathode: 'pin_inexistente' },
                        params: { forwardVoltage: 1.8 },
                    },
                ],
            };

            expect(() => ManifestRegistry.validate(invalidManifest)).toThrow(/Puerto 'cathode' del elemento 'd1' apunta a pin inexistente/);
        });

        it('debe rechazar monitores con acción reset en componentes sin MCU', () => {
            const invalidManifest: ComponentManifest = {
                ...LedManifest,
                id: 'test/invalid-reset-monitor@1',
                mcu: undefined, // Sin MCU
                monitors: [
                    {
                        element: 'd1',
                        quantity: 'voltage',
                        comparison: 'below',
                        limit: 1.0,
                        duration: 1000,
                        event: 'INVALID_RESET',
                        action: 'reset', // No permitido sin MCU
                    },
                ],
            };

            expect(() => ManifestRegistry.validate(invalidManifest)).toThrow(/Acción 'reset' en monitor solo está permitida en componentes con MCU/);
        });
    });
});