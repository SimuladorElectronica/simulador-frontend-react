import { describe, it, expect, vi } from 'vitest';
import {
  ARDUINO_COMPLETIONS,
  ARDUINO_COMPLETION_LABELS,
  ARDUINO_LANGUAGE_ID,
  findArduinoCompletion,
  isArduinoFunction,
} from '../core/editor/arduinoCompletions';
import {
  buildArduinoCompletionItems,
  registerArduinoSupport,
  type MonacoLike,
} from '../core/editor/arduinoMonaco';

function mockMonaco(): MonacoLike & { register: ReturnType<typeof vi.fn> } {
  // Sin parámetros nombrados: vi.fn registra igual los argumentos en mock.calls
  const register = vi.fn(() => ({ dispose: () => {} }));
  return {
    register,
    languages: {
      registerCompletionItemProvider: register,
      CompletionItemKind: { Function: 2, Constant: 20, Snippet: 13 },
    },
    Range: function (startLine: number, startColumn: number, endLine: number, endColumn: number) {
      return { startLine, startColumn, endLine, endColumn };
    } as never,
  } as unknown as MonacoLike & { register: ReturnType<typeof vi.fn> };
}

describe('Autocompletado Arduino Core', () => {
  it('cubre todas las funciones soportadas por el subset (Issue 1.1)', () => {
    const expected = [
      'pinMode',
      'digitalWrite',
      'digitalRead',
      'analogWrite',
      'analogRead',
      'delay',
      'delayMicroseconds',
      'millis',
      'micros',
      'Serial.begin',
      'Serial.print',
      'Serial.println',
      'setup',
      'loop',
    ];
    for (const label of expected) {
      expect(ARDUINO_COMPLETION_LABELS).toContain(label);
      expect(findArduinoCompletion(label)).toBeDefined();
    }
  });

  it('incluye las constantes de modo/nivel y las etiquetas son únicas', () => {
    for (const c of ['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'INPUT_PULLDOWN']) {
      expect(ARDUINO_COMPLETION_LABELS).toContain(c);
    }
    expect(new Set(ARDUINO_COMPLETION_LABELS).size).toBe(ARDUINO_COMPLETIONS.length);
  });

  it('cada función inserta una llamada con paréntesis y snippet', () => {
    for (const c of ARDUINO_COMPLETIONS.filter((x) => x.kind === 'Function')) {
      expect(c.insertText).toMatch(/\(/);
      expect(c.documentation.length).toBeGreaterThan(0);
      expect(isArduinoFunction(c.label)).toBe(true);
    }
    expect(isArduinoFunction('setup')).toBe(false); // snippet, no función
  });

  it('el lenguaje es exclusivamente C++ (cpp)', () => {
    expect(ARDUINO_LANGUAGE_ID).toBe('cpp');
  });
});

describe('registerArduinoSupport (mock de Monaco)', () => {
  it('registra el provider SOLO para cpp y sugiere pinMode/Serial', () => {
    const monaco = mockMonaco();
    const disposable = registerArduinoSupport(monaco);
    expect(disposable.dispose).toBeTypeOf('function');
    expect(monaco.register).toHaveBeenCalledTimes(1);
    expect(monaco.register.mock.calls[0][0]).toBe('cpp'); // nunca otro lenguaje

    const provider = monaco.register.mock.calls[0][1] as {
      provideCompletionItems: (
        m: { getWordUntilPosition: () => { word: string; startColumn: number; endColumn: number } },
        pos: { lineNumber: number; column: number },
      ) => { suggestions: Array<Record<string, unknown>> };
    };
    // Escribiendo "dig": el modelo reporta la palabra y su rango
    const model = {
      getWordUntilPosition: () => ({ word: 'dig', startColumn: 1, endColumn: 4 }),
    };
    const { suggestions } = provider.provideCompletionItems(model, { lineNumber: 1, column: 4 });
    const labels = suggestions.map((s) => s.label);
    expect(labels).toContain('pinMode');
    expect(labels).toContain('Serial.println');
    expect(labels).toContain('digitalWrite');
    expect(labels).toContain('HIGH');

    // El rango debe cubrir la palabra escrita (no ser vacío), para que
    // Monaco filtre por prefijo: es la causa del bug reportado.
    expect(suggestions[0].range).toEqual({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 4,
    });
  });

  it('buildArduinoCompletionItems mapea kind, rango y filterText sin registrar nada', () => {
    const monaco = mockMonaco();
    const items = buildArduinoCompletionItems(monaco, { startLine: 1 } as never);
    expect(items.length).toBe(ARDUINO_COMPLETIONS.length);
    expect(monaco.register).not.toHaveBeenCalled();
    const pinMode = items.find((i) => i.label === 'pinMode')!;
    expect(pinMode.kind).toBe(2); // Function
    expect(pinMode.filterText).toBe('pinMode');
    expect(pinMode.range).toEqual({ startLine: 1 });
  });
});
