import { formatInclude, normalizeHeader } from './headers';
import type { LibraryDefinition } from './types';

/** Línea de `#include` detectada en un sketch. */
export interface SourceInclude {
    header: string;
    /** Índice de línea (base 0). */
    line: number;
}

export interface InjectIncludeResult {
    /** Sketch resultante (idéntico al original si no faltaba nada). */
    source: string;
    /** Headers que se insertaron en esta operación. */
    inserted: string[];
    /** Headers pedidos que ya estaban presentes. */
    existing: string[];
}

/** Acepta espacios, BOM y las formas `<...>` o `"..."`. */
const INCLUDE_PATTERN = /^[ \t\uFEFF]*#[ \t]*include[ \t]*[<"]([^>"]+)[>"]/;

/** Devuelve los `#include` presentes, en orden de aparición. */
export function listIncludes(source: string): SourceInclude[] {
    const out: SourceInclude[] = [];
    const lines = source.split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
        const match = INCLUDE_PATTERN.exec(lines[line]);
        if (match) out.push({ header: normalizeHeader(match[1]), line });
    }
    return out;
}

/** ¿El sketch ya incluye este header? */
export function hasInclude(source: string, header: string): boolean {
    const wanted = normalizeHeader(header);
    return listIncludes(source).some((include) => include.header === wanted);
}

function uniqueHeaders(headers: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const header of headers) {
        const normalized = normalizeHeader(header);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(normalized);
    }
    return out;
}

/**
 * Inserta los headers que falten, sin duplicar los existentes.
 *
 * - Si ya hay `#include`, el bloque nuevo va inmediatamente después del último.
 * - Si no hay, va al inicio del archivo.
 * - Conserva el BOM y el estilo de fin de línea dominante (CRLF/LF).
 */
export function injectIncludes(
    source: string,
    headers: readonly string[],
): InjectIncludeResult {
    const requested = uniqueHeaders(headers);
    const present = new Set(listIncludes(source).map((include) => include.header));
    const existing = requested.filter((header) => present.has(header));
    const missing = requested.filter((header) => !present.has(header));

    if (missing.length === 0) {
        return { source, inserted: [], existing };
    }

    const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
    const body = bom ? source.slice(1) : source;
    const eol = body.includes('\r\n') ? '\r\n' : '\n';
    const lines = body.split(/\r?\n/);
    const includes = listIncludes(body);
    const lastIncludeLine = includes.length > 0 ? includes[includes.length - 1].line : -1;

    const directives = missing.map(formatInclude);
    lines.splice(lastIncludeLine >= 0 ? lastIncludeLine + 1 : 0, 0, ...directives);

    return {
        source: `${bom}${lines.join(eol)}`,
        inserted: missing,
        existing,
    };
}

/** Atajo para insertar todos los headers declarados por una librería. */
export function injectLibraryIncludes(
    source: string,
    library: Pick<LibraryDefinition, 'headers'>,
): InjectIncludeResult {
    return injectIncludes(source, library.headers);
}
