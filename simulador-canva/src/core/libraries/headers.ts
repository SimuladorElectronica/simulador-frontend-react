/**
 * Utilidades de headers C++ compartidas por la búsqueda del catálogo y la
 * inyección de `#include` en el editor.
 */

/** Normaliza `Wire.h`, `<Wire.h>` o `"Wire.h"` a `Wire.h`. */
export function normalizeHeader(header: string): string {
    return header.trim().replace(/^[<"]+/, '').replace(/[>"]+$/, '').trim();
}

/** Construye la directiva que se inserta en el sketch. */
export function formatInclude(header: string): string {
    return `#include <${normalizeHeader(header)}>`;
}

/** Compara dos headers ignorando espacios y delimitadores `<...>` / `"..."`. */
export function sameHeader(a: string, b: string): boolean {
    return normalizeHeader(a) === normalizeHeader(b);
}
