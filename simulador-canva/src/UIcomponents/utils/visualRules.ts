import type { VisualMapping, VisualRule } from '@types';

/* ======================================================================== */
/*  Motor visual: aplica las `visualRules` de un manifiesto a su SVG        */
/*                                                                          */
/*  Es una función pura: recibe el `art` original, las reglas y el estado    */
/*  (parámetros de la instancia ∪ observables publicados por el Worker) y   */
/*  devuelve el SVG a pintar. Nada de DOM: el lienzo es Konva y el SVG se   */
/*  convierte en un data-URI para <img>, así que parchear la cadena es lo   */
/*  único que hace falta (y es barato de memoizar).                         */
/* ======================================================================== */

export type VisualState = Record<string, unknown>;

const DIGIT_COLORS = [
    '#000000', // 0 negro
    '#8d5a2b', // 1 marrón
    '#e74c3c', // 2 rojo
    '#ff9800', // 3 naranja
    '#f1c40f', // 4 amarillo
    '#2ecc71', // 5 verde
    '#3498db', // 6 azul
    '#9b59b6', // 7 violeta
    '#95a5a6', // 8 gris
    '#ecf0f1', // 9 blanco
];

/** Multiplicadores fuera de la escala 0-9 (banda dorada/plata) */
const MULTIPLIER_COLORS: Record<number, string> = {
    [-1]: '#ffd700',
    [-2]: '#c0c0c0',
};

const TOLERANCE_COLOR = '#ffd700'; // oro = ±5 %

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/** Escapa el contenido de texto de un nodo XML. */
export function escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escapa un valor de atributo XML. */
export function escapeAttr(text: string): string {
    return escapeXml(text).replace(/"/g, '&quot;');
}

/** 4700 → "4.7kΩ", 1000000 → "1MΩ", 220 → "220Ω". */
export function formatOhms(value: number): string {
    const trim = (v: number) => Number(v.toPrecision(3)).toString();
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${trim(value / 1e9)}GΩ`;
    if (abs >= 1e6) return `${trim(value / 1e6)}MΩ`;
    if (abs >= 1e3) return `${trim(value / 1e3)}kΩ`;
    return `${trim(value)}Ω`;
}

/**
 * Colores de las bandas de una resistencia a partir de su valor en ohmios.
 * Devuelve 4 colores (2 cifras, multiplicador, tolerancia) o `[]` si el
 * valor queda fuera de la escala de bandas.
 */
export function resistorBandColors(ohms: number): string[] {
    if (!Number.isFinite(ohms) || ohms <= 0) return [];

    const exponent = Math.floor(Math.log10(ohms));
    const mantissa = ohms / 10 ** exponent; // [1, 10)
    let d1 = Math.floor(mantissa);
    let d2 = Math.round((mantissa - d1) * 10);
    let mult = exponent - 1;

    if (d2 === 10) {
        d2 = 0;
        d1 += 1;
    }
    if (d1 === 10) {
        d1 = 1;
        d2 = 0;
        mult += 1;
    }
    if (d1 < 1 || d1 > 9 || d2 < 0 || d2 > 9) return [];

    const multiplierColor = MULTIPLIER_COLORS[mult] ?? DIGIT_COLORS[mult];
    if (!multiplierColor) return [];

    return [DIGIT_COLORS[d1], DIGIT_COLORS[d2], multiplierColor, TOLERANCE_COLOR];
}

/** Contenido SVG de las bandas (los `<rect>` dentro del `<g id="bands">`). */
export function resistorBands(
    ohms: number,
    geometry: { startX: number; startY: number; width: number; height: number; pitch: number },
): string {
    return resistorBandColors(ohms)
        .map(
            (color, i) =>
                `<rect x="${geometry.startX + i * geometry.pitch}" y="${geometry.startY}" ` +
                `width="${geometry.width}" height="${geometry.height}" fill="${color}"/>`,
        )
        .join('');
}

/**
 * Convierte el observable crudo en el valor que se escribe en el SVG.
 * Devuelve `null` cuando la regla no es aplicable (observable ausente,
 * mapeo sin correspondencia…): en ese caso el arte conserva su valor por
 * defecto en lugar de recibir un `NaN`.
 */
export function mapObservable(mapping: VisualMapping, raw: unknown): string | number | null {
    switch (mapping.type) {
        case 'value':
            return typeof raw === 'number' ? round(raw, 4) : String(raw);

        case 'discrete': {
            const mapped = mapping.values[String(raw)];
            return mapped === undefined ? null : mapped;
        }

        case 'linear': {
            const num = Number(raw);
            if (!Number.isFinite(num)) return null;
            const sourceMin = mapping.sourceMin ?? 0;
            const sourceMax = mapping.sourceMax ?? 1;
            const t = sourceMax === sourceMin ? 0 : clamp((num - sourceMin) / (sourceMax - sourceMin), 0, 1);
            return round(mapping.min + t * (mapping.max - mapping.min), mapping.decimals ?? 3);
        }

        case 'text': {
            const num = Number(raw);
            if (!Number.isFinite(num)) return null;
            const body = mapping.format === 'ohms' ? formatOhms(num) : num.toFixed(mapping.decimals ?? 2);
            return `${mapping.prefix ?? ''}${body}${mapping.suffix ?? ''}`;
        }

        case 'rotate': {
            const num = Number(raw);
            if (!Number.isFinite(num)) return null;
            const sourceMin = mapping.sourceMin ?? 0;
            const sourceMax = mapping.sourceMax ?? 180;
            const t = sourceMax === sourceMin ? 0 : clamp((num - sourceMin) / (sourceMax - sourceMin), 0, 1);
            const from = mapping.from ?? 0;
            const to = mapping.to ?? 180;
            return `rotate(${round(from + t * (to - from), 2)} ${mapping.centerX} ${mapping.centerY})`;
        }

        case 'bands': {
            const num = Number(raw);
            if (!Number.isFinite(num)) return null;
            return resistorBands(num, mapping);
        }
    }
}

interface TagSpan {
    tagStart: number;
    tagEnd: number;
    name: string;
    selfClosing: boolean;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Localiza la etiqueta XML que lleva el `id` dado (sin parsear el documento). */
function findTagById(svg: string, id: string): TagSpan | null {
    const match = new RegExp(`\\bid=["']${escapeRegExp(id)}["']`).exec(svg);
    if (!match) return null;

    const tagStart = svg.lastIndexOf('<', match.index);
    if (tagStart < 0) return null;

    const nameMatch = /^<([A-Za-z][\w:.-]*)/.exec(svg.slice(tagStart, tagStart + 64));
    if (!nameMatch) return null;

    // Fin de la etiqueta de apertura, respetando comillas dentro de atributos
    let quote: string | null = null;
    let i = tagStart + 1;
    for (; i < svg.length; i++) {
        const ch = svg[i];
        if (quote) {
            if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '>') {
            break;
        }
    }
    if (i >= svg.length) return null;

    return {
        tagStart,
        tagEnd: i + 1,
        name: nameMatch[1],
        selfClosing: svg[i - 1] === '/',
    };
}

/** Añade o sobreescribe un atributo dentro de una etiqueta. */
function setAttribute(tag: string, name: string, value: string): string {
    const pattern = new RegExp(`\\s${escapeRegExp(name)}=(["'])[^"']*\\1`);
    if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${value}"`);
    if (tag.endsWith('/>')) return `${tag.slice(0, -2)} ${name}="${value}"/>`;
    return `${tag.slice(0, -1)} ${name}="${value}">`;
}

/** Reemplaza el contenido interno de una etiqueta (`<text>…</text>`). */
function setContent(svg: string, span: TagSpan, content: string): string {
    if (span.selfClosing) return svg;
    const closeIdx = svg.indexOf(`</${span.name}`, span.tagEnd);
    if (closeIdx < 0) return svg;
    return `${svg.slice(0, span.tagEnd)}${content}${svg.slice(closeIdx)}`;
}

/**
 * Aplica todas las reglas visuales al `art` del manifiesto.
 *
 * El estado se recibe ya fusionado por el llamado
 * (`{...instance.params, ...workerState}`): los parámetros del documento
 * (color del LED, texto de la LCD) conviven con los observables del Worker
 * (brillo, tensión, ángulo) sin que el Worker tenga que reenviarlos.
 */
export function applyVisualRules(
    art: string,
    rules: VisualRule[] | undefined,
    state: VisualState,
): string {
    if (!rules?.length) return art;

    let out = art;
    for (const rule of rules) {
        const raw = state[rule.observable];
        if (raw === undefined || raw === null) continue;

        const mapped = mapObservable(rule.mapping, raw);
        if (mapped === null) continue;

        const targetId = rule.targetId ?? rule.mapping.targetId;
        if (!targetId) continue;

        const span = findTagById(out, targetId);
        if (!span) continue;

        if (rule.property === 'text' || rule.property === 'content') {
            // Las bandas generan SVG: no se escapan. El texto sí.
            const isRaw = rule.mapping.type === 'bands';
            const content = isRaw ? String(mapped) : escapeXml(String(mapped));
            out = setContent(out, span, content);
        } else {
            const tag = out.slice(span.tagStart, span.tagEnd);
            const patched = setAttribute(tag, rule.property, escapeAttr(String(mapped)));
            out = out.slice(0, span.tagStart) + patched + out.slice(span.tagEnd);
        }
    }
    return out;
}
