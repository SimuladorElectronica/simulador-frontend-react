import { describe, expect, it } from 'vitest';
import { LIBRARY_CATALOG } from '@core/libraries/catalog';
import {
    findLibrary,
    findLibraryByClass,
    findLibraryByHeader,
    getAllLibraries,
    getKnownHeaders,
    getLibraryCategories,
    normalizeLibraryText,
    searchLibraries,
} from '@core/libraries/search';

describe('catálogo curado de librerías', () => {
    it('incluye las tres librerías de la Fase A', () => {
        expect(LIBRARY_CATALOG.map((library) => library.id)).toEqual([
            'LiquidCrystal_I2C',
            'WiFi',
            'PubSubClient',
        ]);
    });

    it('cada entrada declara headers, métodos, keywords y ejemplo', () => {
        for (const library of LIBRARY_CATALOG) {
            expect(library.displayName.length).toBeGreaterThan(0);
            expect(library.description.length).toBeGreaterThan(0);
            expect(library.headers.length).toBeGreaterThan(0);
            expect(library.methods.length).toBeGreaterThan(0);
            expect(library.keywords.length).toBeGreaterThan(0);
            expect(library.example).toContain('#include');
            expect(['lcd-i2c', 'wifi', 'mqtt']).toContain(library.adapter);
        }
    });

    it('los métodos tienen nombre, firma y documentación', () => {
        for (const library of LIBRARY_CATALOG) {
            const names = library.methods.map((method) => method.name);
            expect(new Set(names).size).toBe(names.length);
            for (const method of library.methods) {
                expect(method.name.length).toBeGreaterThan(0);
                expect(method.signature).toContain('(');
                expect(method.documentation.length).toBeGreaterThan(0);
            }
        }
    });

    it('LiquidCrystal_I2C declara los métodos que usa la evidencia', () => {
        const lcd = findLibrary('LiquidCrystal_I2C');
        expect(lcd).toBeDefined();
        expect(lcd?.headers).toEqual(['Wire.h', 'LiquidCrystal_I2C.h']);
        expect(lcd?.className).toBe('LiquidCrystal_I2C');
        expect(lcd?.compatibleManifests).toContain('core/lcd16x2_i2c@1');
        const methods = lcd?.methods.map((method) => method.name) ?? [];
        for (const name of ['init', 'backlight', 'setCursor', 'print', 'clear']) {
            expect(methods).toContain(name);
        }
    });

    it('encuentra por id, header y clase', () => {
        expect(findLibrary('PubSubClient')?.adapter).toBe('mqtt');
        expect(findLibrary('no-existe')).toBeUndefined();
        expect(findLibraryByHeader('<LiquidCrystal_I2C.h>')?.id).toBe('LiquidCrystal_I2C');
        expect(findLibraryByHeader('"WiFi.h"')?.id).toBe('WiFi');
        expect(findLibraryByHeader('Desconocida.h')).toBeUndefined();
        expect(findLibraryByClass('LiquidCrystal_I2C')?.id).toBe('LiquidCrystal_I2C');
        expect(findLibraryByClass('WiFi')).toBeUndefined(); // WiFi es namespace, no objeto
    });

    it('getAllLibraries devuelve el catálogo completo', () => {
        expect(getAllLibraries()).toHaveLength(3);
    });

    it('getKnownHeaders devuelve headers únicos', () => {
        const headers = getKnownHeaders();
        expect(headers).toEqual([
            'Wire.h',
            'LiquidCrystal_I2C.h',
            'WiFi.h',
            'PubSubClient.h',
        ]);
        expect(new Set(headers).size).toBe(headers.length);
    });

    it('getLibraryCategories conserva el orden del catálogo', () => {
        expect(getLibraryCategories()).toEqual(['Pantallas', 'Conectividad']);
    });

    it('normaliza mayúsculas, acentos y espacios', () => {
        expect(normalizeLibraryText('  Pantalla   I2C ')).toBe('pantalla i2c');
        expect(normalizeLibraryText('Conexión')).toBe('conexion');
    });
});

describe('búsqueda de librerías', () => {
    it('busca por nombre, id y categoría', () => {
        expect(searchLibraries('liquid').map((library) => library.id)).toEqual([
            'LiquidCrystal_I2C',
        ]);
        expect(searchLibraries('pantalla').map((library) => library.id)).toContain(
            'LiquidCrystal_I2C',
        );
        expect(searchLibraries('mqtt').map((library) => library.id)).toContain('PubSubClient');
        expect(searchLibraries('wifi').map((library) => library.id)).toContain('WiFi');
    });

    it('exige todos los tokens (AND) y no distingue acentos', () => {
        expect(searchLibraries('lcd i2c').map((library) => library.id)).toEqual([
            'LiquidCrystal_I2C',
        ]);
        expect(searchLibraries('conexion').map((library) => library.id)).toContain('WiFi');
        expect(searchLibraries('lcd mqtt')).toEqual([]);
    });

    it('filtra por categoría', () => {
        const connectivity = searchLibraries('', 'Conectividad');
        expect(connectivity.map((library) => library.id)).toEqual(
            expect.arrayContaining(['WiFi', 'PubSubClient']),
        );
        expect(connectivity.map((library) => library.id)).not.toContain('LiquidCrystal_I2C');
    });

    it('devuelve todo el catálogo con consulta vacía y [] si no hay coincidencias', () => {
        expect(searchLibraries('')).toHaveLength(3);
        expect(searchLibraries('   ')).toHaveLength(3);
        expect(searchLibraries('zzzz')).toEqual([]);
    });

    it('prioriza coincidencias en el nombre', () => {
        const results = searchLibraries('wifi');
        expect(results[0].id).toBe('WiFi');
    });
});
