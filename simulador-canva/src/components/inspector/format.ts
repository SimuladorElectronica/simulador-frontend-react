const EMPTY_VALUES = new Set<unknown>([undefined, null, '']);

/** Formato compacto de valores del worker para el inspector. */
export function fmt(v: unknown): string {
    if (typeof v === 'number') return `${Number(v.toPrecision(4))}`;
    if (typeof v === 'boolean') return v ? 'sí' : 'no';
    if (EMPTY_VALUES.has(v)) return '—';
    return String(v);
}
