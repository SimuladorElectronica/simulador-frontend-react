import type {
    CircuitDocument,
    ComponentInstance,
    ComponentManifest,
    ComponentPinManifest,
    PinReference,
    Wire,
} from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';

/** Colores de los pines según su tipo eléctrico */
export const PIN_COLORS: Record<ComponentPinManifest['kind'], string> = {
    power: '#e74c3c',
    ground: '#2c3e50',
    gpio: '#2980b9',
    analog: '#8e44ad',
    io: '#16a085',
    passive: '#f39c12',
};

/** Convierte el SVG del manifiesto en un data-URI pintable como <img> */
export function svgToDataUrl(art: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art)}`;
}

/** Posición absoluta (coordenadas de mundo) de un pin de una instancia */
export function pinAbsolutePos(
    instance: ComponentInstance,
    pin: ComponentPinManifest,
): { x: number; y: number } {
    return { x: instance.position.x + pin.position.x, y: instance.position.y + pin.position.y };
}

/** Busca un pin por id dentro del manifiesto */
export function findPin(
    manifest: ComponentManifest,
    pinId: string,
): ComponentPinManifest | undefined {
    return manifest.pins.find((p) => p.id === pinId);
}

/**
 * Lado del componente al que mira un pin (-1 izquierda, 1 derecha).
 * Determina la dirección de la curva de un cable.
 */
export function pinSide(pin: ComponentPinManifest, manifest: ComponentManifest): 1 | -1 {
    return pin.position.x <= manifest.size.width / 2 ? -1 : 1;
}

/** Path bézier cúbica entre dos pines, con curvatura natural según el lado de salida */
export function bezierPath(
    p1: { x: number; y: number },
    dir1: 1 | -1,
    p2: { x: number; y: number },
    dir2: 1 | -1,
): string {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const offset = Math.max(24, Math.min(100, dist * 0.5));
    return [
        `M ${p1.x} ${p1.y}`,
        `C ${p1.x + dir1 * offset} ${p1.y}`,
        `${p2.x + dir2 * offset} ${p2.y}`,
        `${p2.x} ${p2.y}`,
    ].join(' ');
}

/**
 * Resuelve el path bézier de un cable a partir de un documento concreto.
 *
 * Importante: es una función pura que recibe el documento como argumento en
 * lugar de leer el store de forma imperativa. Así, los componentes de vista
 * reciben el resultado como prop primitiva (un string), lo que garantiza que
 * React re-renderice cuando cambia (React Compiler trata las lecturas
 * imperativas de stores de módulo como valores no reactivos y puede omitir el
 * re-render, dejando los cables en el aire al arrastrar).
 *
 * Devuelve `null` si el cable referencia componentes, manifiestos o pines
 * inexistentes (documento degradado).
 */
export function resolveWirePath(doc: CircuitDocument, wire: Wire): string | null {
    const fromComp = doc.components.find((c) => c.id === wire.from.componentId);
    const toComp = doc.components.find((c) => c.id === wire.to.componentId);
    if (!fromComp || !toComp) return null;

    const fromManifest = ManifestRegistry.get(fromComp.type);
    const toManifest = ManifestRegistry.get(toComp.type);
    if (!fromManifest || !toManifest) return null;

    const fromPin = findPin(fromManifest, wire.from.pinId);
    const toPin = findPin(toManifest, wire.to.pinId);
    if (!fromPin || !toPin) return null;

    const p1 = pinAbsolutePos(fromComp, fromPin);
    const p2 = pinAbsolutePos(toComp, toPin);
    return bezierPath(p1, pinSide(fromPin, fromManifest), p2, pinSide(toPin, toManifest));
}

/**
 * Resuelve el path de la línea guía temporal mientras se traza un cable.
 * Igual que `resolveWirePath`, es una función pura sobre el documento.
 */
export function resolveGuidePath(
    doc: CircuitDocument,
    from: PinReference,
    pointer: { x: number; y: number },
): string | null {
    const comp = doc.components.find((c) => c.id === from.componentId);
    if (!comp) return null;
    const manifest = ManifestRegistry.get(comp.type);
    if (!manifest) return null;
    const pin = findPin(manifest, from.pinId);
    if (!pin) return null;

    const p1 = pinAbsolutePos(comp, pin);
    const dir1 = pinSide(pin, manifest);
    const dir2: 1 | -1 = dir1 === 1 ? -1 : 1;
    return bezierPath(p1, dir1, pointer, dir2);
}

/**
 * Pin más cercano a una posición de mundo, dentro de un radio dado.
 * Se ignora cualquier componente cuyo manifiesto no esté registrado.
 */
export function findNearestPin(
    world: { x: number; y: number },
    components: ComponentInstance[],
    getManifest: (type: string) => ComponentManifest | undefined,
    maxDistance: number = 12,
): PinReference | null {
    let best: { ref: PinReference; dist: number } | null = null;
    for (const comp of components) {
        const manifest = getManifest(comp.type);
        if (!manifest) continue;
        for (const pin of manifest.pins) {
            const p = pinAbsolutePos(comp, pin);
            const d = Math.hypot(p.x - world.x, p.y - world.y);
            if (d <= maxDistance && (!best || d < best.dist)) {
                best = { ref: { componentId: comp.id, pinId: pin.id }, dist: d };
            }
        }
    }
    return best?.ref ?? null;
}
