import { describe, it, expect, vi } from 'vitest';
import {
  buildLibraryCompletionItems,
  isLibraryActive,
} from '../core/editor/libraryCompletions';
import { LIBRARY_CATALOG } from '../core/libraries/catalog';
import {
  buildArduinoCompletionItems,
  registerArduinoSupport,
  type MonacoLike,
} from '../core/editor/arduinoMonaco';
import { ARDUINO_COMPLETION_LABELS } from '../core/editor/arduinoCompletions';
import { DEFAULT_SKETCH } from '../core/editor/defaultSketch';

function mockMonaco(): MonacoLike & { register: ReturnType<typeof vi.fn> } {
  const register = vi.fn(() => ({ dispose: () => {} }));
  return {
    register,
    languages: {
      registerCompletionItemProvider: register,
      CompletionItemKind: { Function: 2, Constant: 20, Snippet: 13, Method: 1 },
    },
    Range: function (
      startLine: number,
      startColumn: number,
      endLine: number,
      endColumn: number,
    ) {
      return { startLine, startColumn, endLine, endColumn };
    } as never,
  } as unknown as MonacoLike & { register: ReturnType<typeof vi.fn> };
}

const range = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as never;

const LCD_INCLUDES = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

void setup() {
  lcd.init();
}
void loop() {}
`;

const LCD_DECLARED = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
}
void loop() {}
`;

const WIFI_INCLUDED = `#include <WiFi.h>

void setup() {}
void loop() {}
`;

const labels = (items: Array<{ label: string }>) => items.map((item) => item.label);

describe('libraryCompletions', () => {
  it('sin ninguna librería activa no hay sugerencias de librerías', () => {
    const items = buildLibraryCompletionItems(mockMonaco(), range, DEFAULT_SKETCH);
    expect(items).toHaveLength(0);
  });

  it('una dependencia común no activa la librería (Wire.h solo no sugiere LCD)', () => {
    const library = LIBRARY_CATALOG.find((lib) => lib.id === 'LiquidCrystal_I2C')!;
    expect(isLibraryActive('#include <Wire.h>\nvoid setup() {}\nvoid loop() {}', library)).toBe(
      false,
    );
    expect(isLibraryActive(LCD_INCLUDES, library)).toBe(true);
  });

  it('con el header propio sugiere la declaración (no los métodos si no hay objeto)', () => {
    const items = buildLibraryCompletionItems(mockMonaco(), range, LCD_INCLUDES);
    const itemLabels = labels(items);

    expect(itemLabels).toContain('LiquidCrystal_I2C lcd(0x27, 16, 2);');
    expect(itemLabels.some((label) => label.startsWith('lcd.'))).toBe(false);

    const declaration = items.find((item) => item.label === 'LiquidCrystal_I2C lcd(0x27, 16, 2);')!;
    expect(declaration.insertText).toContain('LiquidCrystal_I2C lcd(0x27, 16, 2);');
    expect(declaration.kind).toBe(13); // Snippet
    expect(declaration.documentation).toContain('uint8_t address');
  });

  it('con el objeto declarado sugiere los métodos del catálogo LCD', () => {
    const items = buildLibraryCompletionItems(mockMonaco(), range, LCD_DECLARED);
    const itemLabels = labels(items);

    expect(itemLabels).toContain('lcd.init');
    expect(itemLabels).toContain('lcd.setCursor');
    expect(itemLabels).toContain('lcd.print');
    expect(itemLabels).toContain('lcd.backlight');

    // Ya está declarado: no se sugiere declararlo de nuevo.
    expect(itemLabels).not.toContain('LiquidCrystal_I2C lcd(0x27, 16, 2);');

    const print = items.find((item) => item.label === 'lcd.print')!;
    expect(print.insertText).toBe('lcd.print(${1:value})$0');
    expect(print.kind).toBe(1); // Method

    const setCursor = items.find((item) => item.label === 'lcd.setCursor')!;
    expect(setCursor.insertText).toBe('lcd.setCursor(${1:column}, ${2:row})$0');
  });

  it('con <WiFi.h> sugiere los métodos de namespace estático', () => {
    const items = buildLibraryCompletionItems(mockMonaco(), range, WIFI_INCLUDED);
    const itemLabels = labels(items);

    expect(itemLabels).toContain('WiFi.begin');
    expect(itemLabels).toContain('WiFi.status');
    expect(itemLabels).toContain('WiFi.localIP');

    const begin = items.find((item) => item.label === 'WiFi.begin')!;
    expect(begin.insertText).toBe('WiFi.begin(${1:ssid}, ${2:password})$0');
    expect(begin.detail).toBe('begin(ssid, password)');
  });

  it('con <WiFi.h> + <PubSubClient.h> y el objeto declarado sugiere client.publish', () => {
    const source = `#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {}
void loop() {}
`;
    const itemLabels = labels(buildLibraryCompletionItems(mockMonaco(), range, source));
    expect(itemLabels).toContain('client.publish');
    expect(itemLabels).toContain('client.setServer');
    expect(itemLabels).toContain('client.connected');
    expect(itemLabels).toContain('WiFi.begin');
    // Objeto ya declarado: no se sugiere su declaración
    expect(itemLabels).not.toContain('PubSubClient client(espClient);');
  });

  it('la declaración se sugiere para PubSubClient si falta declararla', () => {
    const source = `#include <WiFi.h>
#include <PubSubClient.h>

void setup() {}
void loop() {}
`;
    const itemLabels = labels(buildLibraryCompletionItems(mockMonaco(), range, source));
    expect(itemLabels).toContain('PubSubClient client(espClient);');
  });
});

describe('provider del editor con librerías (mock de Monaco)', () => {
  const modelWith = (source: string) => ({
    getWordUntilPosition: () => ({ word: 'lcd.', startColumn: 1, endColumn: 5 }),
    getValue: () => source,
  });

  it('sugiere core Arduino y métodos de la LCD juntos', () => {
    const monaco = mockMonaco();
    registerArduinoSupport(monaco);
    const provider = monaco.register.mock.calls[0][1] as {
      provideCompletionItems: (
        m: ReturnType<typeof modelWith>,
        pos: { lineNumber: number; column: number },
      ) => { suggestions: Array<{ label: string }> };
    };

    const { suggestions } = provider.provideCompletionItems(modelWith(LCD_DECLARED), {
      lineNumber: 1,
      column: 5,
    });
    const suggestionLabels = suggestions.map((s) => s.label);

    // Núcleo Arduino
    expect(suggestionLabels).toContain('pinMode');
    expect(suggestionLabels).toContain('digitalRead');
    // Librerías
    expect(suggestionLabels).toContain('lcd.print');
    expect(suggestionLabels).toContain('lcd.setCursor');
  });

  it('un modelo sin getValue no rompe ni sugiere librerías (solo core)', () => {
    const monaco = mockMonaco();
    registerArduinoSupport(monaco);
    const provider = monaco.register.mock.calls[0][1] as {
      provideCompletionItems: (
        m: { getWordUntilPosition: () => { word: string; startColumn: number; endColumn: number } },
        pos: { lineNumber: number; column: number },
      ) => { suggestions: Array<{ label: string }> };
    };

    const legacyModel = {
      getWordUntilPosition: () => ({ word: 'pin', startColumn: 1, endColumn: 4 }),
    };
    const { suggestions } = provider.provideCompletionItems(legacyModel, {
      lineNumber: 1,
      column: 4,
    });
    const suggestionLabels = suggestions.map((s) => s.label);

    expect(suggestionLabels).toContain('pinMode');
    expect(suggestionLabels).toEqual(expect.arrayContaining([...ARDUINO_COMPLETION_LABELS]));
    expect(suggestionLabels).not.toContain('lcd.print');
  });

  it('buildArduinoCompletionItems sigue sin registrar nada', () => {
    const monaco = mockMonaco();
    const items = buildArduinoCompletionItems(monaco, range);
    expect(monaco.register).not.toHaveBeenCalled();
    expect(items.length).toBeGreaterThan(0);
  });
});
