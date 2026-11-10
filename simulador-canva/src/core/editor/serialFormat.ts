/**
 * Formato puro de la Consola Serial UART (sin React).
 * Funciones testeables: formateo de timestamps, buffer y filtrado.
 */

export interface SerialEntryLike {
  timeUs: number;
  text: string;
}

/** `[1234us] texto` — mismo formato que ya mostraba el panel. */
export function formatSerialEntry(entry: SerialEntryLike): string {
  return `[${entry.timeUs}us] ${entry.text}`;
}

/** Buffer completo como texto plano (para copiar / exportar a .txt). */
export function formatSerialBuffer(entries: readonly SerialEntryLike[]): string {
  return entries.map(formatSerialEntry).join('\n');
}

/**
 * Filtra el buffer por texto (case-insensitive).
 * Query vacía = sin filtrado.
 */
export function filterSerialEntries<T extends SerialEntryLike>(
  entries: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter((e) => e.text.toLowerCase().includes(q));
}

/** Cantidad de bytes (UTF-8 aproximado) del buffer para el pie de consola. */
export function serialBufferBytes(entries: readonly SerialEntryLike[]): number {
  return new TextEncoder().encode(formatSerialBuffer(entries)).length;
}

/** ¿Se salta el buffer al final? Solo si autoscroll está activo. */
export function shouldAutoScroll(autoScroll: boolean, paused: boolean): boolean {
  return autoScroll && !paused;
}
