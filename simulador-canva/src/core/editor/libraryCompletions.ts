/**
 * Autocompletado de librerías curadas para el editor Monaco.
 *
 * Mismo principio que `arduinoCompletions.ts`: módulo de datos puro (sin
 * importar Monaco) para poder testearlo sin descargar el runtime del editor.
 *
 * Qué sugiere, en función del contenido actual del sketch (`model.getValue()`):
 *
 * - **Declaración sugerida**: si el sketch incluye un header de una librería
 *   declarativa (p. ej. `<LiquidCrystal_I2C.h>`) y el objeto todavía NO está
 *   declarado, sugiere el snippet de declaración del catálogo
 *   (`LiquidCrystal_I2C lcd(0x27, 16, 2);`).
 * - **Métodos del objeto**: si el sketch declara un objeto (`lcd.print(`,
 *   `client.publish(`), sugiere los métodos de su librería con firma y docs.
 * - **Métodos de namespace estático**: si el sketch incluye `<WiFi.h>`,
 *   sugiere los métodos de `WiFi` (`WiFi.begin(`, `WiFi.status(`…).
 *
 * La librería se considera "activa" si alguno de sus headers aparece en el
 * sketch: el catálogo está acotado, no hay falsos positivos externos.
 */
import { LIBRARY_CATALOG } from '../libraries/catalog';
import { normalizeHeader } from '../libraries/headers';
import { listIncludes } from '../libraries/injectInclude';
import { parseLibraryObjects } from '../runtime/libraryRuntime';
import type { LibraryDefinition, LibraryMethodDefinition } from '../libraries/types';
import type { MonacoLike } from './arduinoMonaco';

/** Sugerencia lista para Monaco (mismos campos que las del core Arduino). */
export interface LibraryCompletionItem {
    label: string;
    kind: number;
    detail: string;
    documentation: string;
    insertText: string;
    insertTextRules: number;
    filterText: string;
    range: unknown;
}

const SNIPPET_RULE = 4; // Monaco CompletionItemInsertTextRule.Snippet

/** Kind con fallback numérico (especificación LSP): Method=1, Function=2, Snippet=13. */
function kindOf(
    monaco: MonacoLike,
    name: 'Method' | 'Function' | 'Snippet',
): number {
    const fallback = { Method: 1, Function: 2, Snippet: 13 }[name];
    return monaco.languages.CompletionItemKind?.[name] ?? fallback;
}

/** Headers del sketch, normalizados. */
function includeSet(source: string): Set<string> {
    return new Set(listIncludes(source).map((include) => normalizeHeader(include.header)));
}

/**
 * Header propio de la librería. Convención del catálogo: el header específico
 * va último (`LiquidCrystal_I2C.h`, `PubSubClient.h`, `WiFi.h`) y las
 * dependencias comunes primero (`Wire.h`, `WiFi.h` para MQTT). Así, incluir
 * una dependencia no "activa" la librería dependiente.
 */
function primaryHeader(library: LibraryDefinition): string {
    return normalizeHeader(library.headers[library.headers.length - 1] ?? '');
}

/** ¿El sketch incluye el header propio de la librería? */
export function isLibraryActive(source: string, library: LibraryDefinition): boolean {
    const includes = includeSet(source);
    return includes.has(primaryHeader(library));
}

/**
 * Divide la lista de parámetros de una firma en sus posiciones de nivel
 * superior. Los headers curadas usan firmas simples (`setCursor(column, row)`);
 * esto solo protege contra comas anidadas y defaults.
 */
function splitSignatureParams(signature: string): string[] {
    const open = signature.indexOf('(');
    const close = signature.lastIndexOf(')');
    if (open < 0 || close <= open) return [];

    const inner = signature.slice(open + 1, close).trim();
    if (!inner) return [];

    const out: string[] = [];
    let current = '';
    let depth = 0;
    for (const char of inner) {
        if (char === '(' || char === '<') depth++;
        else if (char === ')' || char === '>') depth = Math.max(0, depth - 1);
        if (char === ',' && depth === 0) {
            out.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) out.push(current.trim());
    return out;
}

/** Parámetro → placeholder de snippet (`column` → `${1:column}`). */
function toSnippetArgs(params: string[]): string {
    return params.map((param, index) => `\${${index + 1}:${param}}`).join(', ');
}

/** Objeto de librería declarado en el sketch (p. ej. `lcd`, `client`). */
interface DeclaredObject {
    name: string;
    library: LibraryDefinition;
}

function declaredObjects(source: string): DeclaredObject[] {
    const out: DeclaredObject[] = [];
    for (const declaration of parseLibraryObjects(source)) {
        const library = LIBRARY_CATALOG.find((lib) => lib.id === declaration.libraryId);
        if (library) out.push({ name: declaration.name, library });
    }
    return out;
}

function methodItem(
    monaco: MonacoLike,
    range: unknown,
    objectPrefix: string,
    method: LibraryMethodDefinition,
): LibraryCompletionItem {
    const params = splitSignatureParams(method.signature);
    const args = toSnippetArgs(params);
    const label = `${objectPrefix}.${method.name}`;

    return {
        label,
        kind: kindOf(monaco, 'Method'),
        detail: method.signature,
        documentation: method.documentation,
        insertText: `${label}(${args})$0`,
        insertTextRules: SNIPPET_RULE,
        filterText: label,
        range,
    };
}

function declarationItem(
    monaco: MonacoLike,
    range: unknown,
    library: LibraryDefinition,
): LibraryCompletionItem | null {
    if (!library.declarationTemplate || !library.constructorSignature) return null;

    return {
        label: library.declarationTemplate,
        kind: kindOf(monaco, 'Snippet'),
        detail: `${library.displayName} — declaración`,
        documentation: `Declaración sugerida. Insertá objeto una vez (global), antes de setup(): ${library.constructorSignature}`,
        insertText: `${library.declarationTemplate}$0`,
        insertTextRules: SNIPPET_RULE,
        filterText: library.className ?? library.id,
        range,
    };
}

/**
 * Snippet de declaración de la librería (si aplica y no está declarada).
 * Se ofrece al escribir el nombre de la clase tras incluir su header.
 */
function buildDeclarationItems(
    monaco: MonacoLike,
    range: unknown,
    source: string,
    declared: DeclaredObject[],
): LibraryCompletionItem[] {
    const declaredIds = new Set(declared.map((entry) => entry.library.id));
    const items: LibraryCompletionItem[] = [];

    for (const library of LIBRARY_CATALOG) {
        if (!isLibraryActive(source, library)) continue;
        if (declaredIds.has(library.id)) continue; // ya declarada
        const item = declarationItem(monaco, range, library);
        if (item) items.push(item);
    }
    return items;
}

/** Métodos de los objetos declarados en el sketch (`lcd.print(`, etc.). */
function buildObjectMethodItems(
    monaco: MonacoLike,
    range: unknown,
    declared: DeclaredObject[],
): LibraryCompletionItem[] {
    const items: LibraryCompletionItem[] = [];
    for (const { name, library } of declared) {
        for (const method of library.methods) {
            items.push(methodItem(monaco, range, name, method));
        }
    }
    return items;
}

/** Métodos de namespace estático (`WiFi.begin(`, etc.). */
function buildStaticMethodItems(
    monaco: MonacoLike,
    range: unknown,
    source: string,
): LibraryCompletionItem[] {
    const items: LibraryCompletionItem[] = [];
    for (const library of LIBRARY_CATALOG) {
        if (!library.static) continue;
        if (!isLibraryActive(source, library)) continue;
        for (const method of library.methods) {
            items.push(methodItem(monaco, range, library.id, method));
        }
    }
    return items;
}

/**
 * Sugerencias de librerías para el sketch actual.
 * `range` lo calcula el provider de Monaco (rango de la palabra en curso).
 */
export function buildLibraryCompletionItems(
    monaco: MonacoLike,
    range: unknown,
    source: string,
): LibraryCompletionItem[] {
    const declared = declaredObjects(source);

    return [
        ...buildDeclarationItems(monaco, range, source, declared),
        ...buildObjectMethodItems(monaco, range, declared),
        ...buildStaticMethodItems(monaco, range, source),
    ];
}
