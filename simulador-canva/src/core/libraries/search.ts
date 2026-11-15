import { LIBRARY_CATALOG } from './catalog';
import { normalizeHeader } from './headers';
import type { LibraryCategory, LibraryDefinition } from './types';

/** Minúsculas, sin acentos y con espacios colapsados (búsqueda amigable). */
export function normalizeLibraryText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function searchableText(library: LibraryDefinition): string {
    return normalizeLibraryText(
        [
            library.id,
            library.displayName,
            library.description,
            library.category,
            ...library.headers,
            ...library.keywords,
            ...library.methods.map((method) => `${method.name} ${method.signature}`),
        ].join(' '),
    );
}

/** Puntaje simple para que los aciertos por nombre/header queden arriba. */
function relevance(library: LibraryDefinition, query: string): number {
    if (!query) return 0;
    const id = normalizeLibraryText(library.id);
    const name = normalizeLibraryText(library.displayName);
    const headers = library.headers.map((header) => normalizeLibraryText(normalizeHeader(header)));
    const keywords = library.keywords.map(normalizeLibraryText);

    let score = 0;
    if (name.startsWith(query)) score += 10;
    if (id.startsWith(query)) score += 8;
    if (headers.some((header) => header.startsWith(query))) score += 6;
    if (keywords.some((keyword) => keyword.startsWith(query))) score += 4;
    if (name.includes(query)) score += 2;
    return score;
}

/**
 * Busca librerías por nombre, id, categoría, headers, keywords y métodos.
 * Todos los tokens de la consulta deben aparecer (AND), en cualquier orden.
 */
export function searchLibraries(
    query: string,
    category?: LibraryCategory,
): LibraryDefinition[] {
    const normalizedQuery = normalizeLibraryText(query);
    const tokens = normalizedQuery.split(' ').filter(Boolean);

    return LIBRARY_CATALOG.filter((library) => {
        if (category && library.category !== category) return false;
        if (tokens.length === 0) return true;
        const haystack = searchableText(library);
        return tokens.every((token) => haystack.includes(token));
    }).sort((a, b) => {
        const byScore = relevance(b, normalizedQuery) - relevance(a, normalizedQuery);
        if (byScore !== 0) return byScore;
        return a.displayName.localeCompare(b.displayName, 'es');
    });
}

/** Todas las librerías del catálogo, en el orden declarado. */
export function getAllLibraries(): readonly LibraryDefinition[] {
    return LIBRARY_CATALOG;
}

/** Busca por id exacto (p. ej. `LiquidCrystal_I2C`). */
export function findLibrary(id: string): LibraryDefinition | undefined {
    return LIBRARY_CATALOG.find((library) => library.id === id);
}

/** Busca la librería que instala un header (acepta `<Wire.h>` o `Wire.h`). */
export function findLibraryByHeader(header: string): LibraryDefinition | undefined {
    return LIBRARY_CATALOG.find((library) =>
        library.headers.some((candidate) => normalizeHeader(candidate) === normalizeHeader(header)),
    );
}

/** Busca por la clase C++ que se declara en el sketch. */
export function findLibraryByClass(className: string): LibraryDefinition | undefined {
    return LIBRARY_CATALOG.find((library) => library.className === className);
}

/** Headers únicos de todo el catálogo, en orden de aparición. */
export function getKnownHeaders(): string[] {
    return [...new Set(LIBRARY_CATALOG.flatMap((library) => library.headers))];
}

/** Categorías presentes en el catálogo, en orden de aparición. */
export function getLibraryCategories(): LibraryCategory[] {
    return [...new Set(LIBRARY_CATALOG.map((library) => library.category))];
}
