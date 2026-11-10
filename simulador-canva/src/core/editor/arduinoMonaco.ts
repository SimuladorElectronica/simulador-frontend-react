/**
 * Registro del soporte Arduino en una instancia de Monaco ya cargada.
 *
 * Se invoca desde el `onMount` de `@monaco-editor/react`, es decir,
 * SOLO cuando el usuario ya abrió el editor (carga diferida). Este
 * módulo no importa Monaco: recibe la instancia por parámetro, así
 * el bundle inicial no incluye nada del editor y los tests pueden
 * pasar un mock mínimo.
 */
import {
  ARDUINO_COMPLETIONS,
  ARDUINO_LANGUAGE_ID,
} from './arduinoCompletions';

/** Posición del cursor en el modelo (1-based). */
export interface EditorPositionLike {
  lineNumber: number;
  column: number;
}

/**
 * Forma mínima del modelo de texto de Monaco que necesitamos.
 * `getWordUntilPosition` devuelve la palabra que se está escribiendo
 * y su rango, que es lo que permite a Monaco filtrar las sugerencias
 * por el prefijo real (p. ej. "dig" → digitalRead/digitalWrite).
 */
export interface TextModelLike {
  getWordUntilPosition(position: EditorPositionLike): {
    word: string;
    startColumn: number;
    endColumn: number;
  };
}

/** Forma mínima de la API de Monaco que necesitamos (mockeable en tests). */
export interface MonacoLike {
  languages: {
    registerCompletionItemProvider: (
      languageId: string,
      provider: unknown,
    ) => { dispose: () => void };
    CompletionItemKind?: Record<string, number>;
    CompletionTriggerKind?: Record<string, number>;
  };
  Range?: new (
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
  ) => unknown;
}

/** Resuelve un kind de Monaco con fallback numérico (especificación LSP). */
function kindOf(monaco: MonacoLike, name: 'Function' | 'Constant' | 'Snippet'): number {
  const fallback = { Function: 2, Constant: 20, Snippet: 13 }[name];
  return monaco.languages.CompletionItemKind?.[name] ?? fallback;
}

/**
 * Construye las sugerencias para un rango de edición dado.
 * Exportada para tests: no registra nada, solo mapea datos puros.
 *
 * `filterText` repite la etiqueta para que Monaco aplique su filtro
 * por prefijo sobre el texto correcto (y no sobre el insertText, que
 * incluye snippets con placeholders).
 */
export function buildArduinoCompletionItems(
  monaco: MonacoLike,
  range: unknown,
): Array<Record<string, unknown>> {
  return ARDUINO_COMPLETIONS.map((c) => ({
    label: c.label,
    kind: kindOf(monaco, c.kind),
    detail: c.detail,
    documentation: c.documentation,
    insertText: c.insertText,
    insertTextRules: 4, // Snippet
    filterText: c.label,
    range,
  }));
}

/**
 * Rango de la palabra bajo el cursor. Sin este rango Monaco recibe
 * un rango vacío, no sabe qué prefijo se está escribiendo y muestra
 * TODAS las sugerencias sin filtrar (el bug reportado: "dig" sugería
 * analogRead y otras funciones sin relación).
 */
function wordRange(
  monaco: MonacoLike,
  model: TextModelLike | undefined,
  position: EditorPositionLike,
): unknown {
  if (!monaco.Range) return undefined;
  const word =
    model && typeof model.getWordUntilPosition === 'function'
      ? model.getWordUntilPosition(position)
      : { word: '', startColumn: position.column, endColumn: position.column };
  return new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn,
  );
}

/**
 * Registra el provider de autocompletado Arduino SOLO para C++.
 * Devuelve el disposable del registro (para tests / cleanup).
 */
export function registerArduinoSupport(monaco: MonacoLike): { dispose: () => void } {
  return monaco.languages.registerCompletionItemProvider(ARDUINO_LANGUAGE_ID, {
    triggerCharacters: ['.'],
    provideCompletionItems: (
      model: TextModelLike | undefined,
      position: EditorPositionLike,
    ) => ({
      suggestions: buildArduinoCompletionItems(
        monaco,
        wordRange(monaco, model, position),
      ),
    }),
  });
}
