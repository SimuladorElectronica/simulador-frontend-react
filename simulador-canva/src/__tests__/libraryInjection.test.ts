import { describe, expect, it } from 'vitest';
import { formatInclude, normalizeHeader, sameHeader } from '@core/libraries/headers';
import {
    hasInclude,
    injectIncludes,
    injectLibraryIncludes,
    listIncludes,
} from '@core/libraries/injectInclude';
import { findLibrary } from '@core/libraries/search';

describe('headers C++', () => {
    it('normaliza las formas habituales de escribir un include', () => {
        expect(normalizeHeader('Wire.h')).toBe('Wire.h');
        expect(normalizeHeader('<Wire.h>')).toBe('Wire.h');
        expect(normalizeHeader('"Wire.h"')).toBe('Wire.h');
        expect(normalizeHeader('  < Wire.h >  ')).toBe('Wire.h');
    });

    it('formatea y compara headers', () => {
        expect(formatInclude('Wire.h')).toBe('#include <Wire.h>');
        expect(formatInclude('<Wire.h>')).toBe('#include <Wire.h>');
        expect(sameHeader('<Wire.h>', 'Wire.h')).toBe(true);
        expect(sameHeader('Wire.h', 'SPI.h')).toBe(false);
    });
});

describe('detección de #include', () => {
    it('lista includes en orden e ignora comentarios', () => {
        const source = [
            '  #include <Wire.h>',
            '// #include <Comentado.h>',
            '#include "PubSubClient.h"',
            'void setup() {}',
        ].join('\n');

        expect(listIncludes(source)).toEqual([
            { header: 'Wire.h', line: 0 },
            { header: 'PubSubClient.h', line: 2 },
        ]);
        expect(hasInclude(source, '<Wire.h>')).toBe(true);
        expect(hasInclude(source, 'LiquidCrystal_I2C.h')).toBe(false);
    });
});

describe('inyección de #include', () => {
    it('inserta los headers en un sketch vacío', () => {
        const result = injectIncludes('', ['Wire.h', 'LiquidCrystal_I2C.h']);

        expect(result.source).toBe('#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\n');
        expect(result.inserted).toEqual(['Wire.h', 'LiquidCrystal_I2C.h']);
        expect(result.existing).toEqual([]);
    });

    it('inserta después del último include existente', () => {
        const source = '#include <Arduino.h>\n\nvoid setup() {}\n';
        const result = injectIncludes(source, ['Wire.h']);

        expect(result.source).toBe(
            '#include <Arduino.h>\n#include <Wire.h>\n\nvoid setup() {}\n',
        );
        expect(result.inserted).toEqual(['Wire.h']);
    });

    it('inserta al inicio si no hay includes', () => {
        const source = 'void setup() {}\n';
        const result = injectIncludes(source, ['Wire.h']);

        expect(result.source).toBe('#include <Wire.h>\nvoid setup() {}\n');
    });

    it('no duplica headers escritos con <>, comillas o espacios', () => {
        const source = '#include <Wire.h>\n#include "LiquidCrystal_I2C.h"\n';
        const result = injectIncludes(source, [
            '<Wire.h>',
            'LiquidCrystal_I2C.h',
            'PubSubClient.h',
        ]);

        expect(result.inserted).toEqual(['PubSubClient.h']);
        expect(result.existing).toEqual(['Wire.h', 'LiquidCrystal_I2C.h']);
        expect(result.source).toBe(
            '#include <Wire.h>\n#include "LiquidCrystal_I2C.h"\n#include <PubSubClient.h>\n',
        );
    });

    it('devuelve el mismo texto si ya estaban todos', () => {
        const source = '#include <Wire.h>\nvoid setup() {}\n';
        const result = injectIncludes(source, ['Wire.h']);

        expect(result.source).toBe(source);
        expect(result.inserted).toEqual([]);
        expect(result.existing).toEqual(['Wire.h']);
    });

    it('deduplica la lista de headers pedidos', () => {
        const result = injectIncludes('', ['Wire.h', '<Wire.h>', 'Wire.h']);
        expect(result.source).toBe('#include <Wire.h>\n');
        expect(result.inserted).toEqual(['Wire.h']);
    });

    it('conserva fin de línea CRLF', () => {
        const source = '#include <Arduino.h>\r\nvoid setup() {}\r\n';
        const result = injectIncludes(source, ['Wire.h']);

        expect(result.source).toBe(
            '#include <Arduino.h>\r\n#include <Wire.h>\r\nvoid setup() {}\r\n',
        );
        expect(result.source).not.toMatch(/(?<!\r)\n/);
    });

    it('conserva el BOM si el archivo lo tenía', () => {
        const source = '\uFEFF#include <Arduino.h>\nvoid setup() {}\n';
        const result = injectIncludes(source, ['Wire.h']);

        expect(result.source.startsWith('\uFEFF')).toBe(true);
        expect(result.source).toContain('#include <Wire.h>\n');
    });

    it('inserta todos los headers de una librería del catálogo', () => {
        const lcd = findLibrary('LiquidCrystal_I2C');
        expect(lcd).toBeDefined();

        const result = injectLibraryIncludes('void setup() {}\n', lcd!);
        expect(result.source).toBe(
            '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nvoid setup() {}\n',
        );
    });
});
