import { useEffect, useState } from 'react';

/* ======================================================================== */
/*  Carga de SVG como <img> con caché LRU compartida                         */
/*                                                                          */
/*  Reemplaza a `use-image`: esa librería devuelve `undefined` mientras     */
/*  carga y, lo peor, VUELVE a `undefined` cuando cambia la URL, así que   */
/*  cada actualización de estado (brillo, ángulo, texto…) vaciaba el        */
/*  componente un frame y la parpadeaba.                                    */
/*                                                                          */
/*  Aquí:                                                                    */
/*   - el resultado se guarda por URL en una caché LRU del módulo, así     */
/*     que re-renderizar con el mismo arte es síncrono;                      */
/*   - si la URL cambia, se sigue pintando la imagen anterior hasta que la   */
/*     nueva termine de cargar (nunca un hueco gris).                       */
/* ======================================================================== */

const MAX_CACHE_ENTRIES = 256;
const imageCache = new Map<string, HTMLImageElement | null>();

function remember(url: string, image: HTMLImageElement | null): void {
    imageCache.delete(url);
    imageCache.set(url, image);
    while (imageCache.size > MAX_CACHE_ENTRIES) {
        const oldest = imageCache.keys().next().value;
        if (oldest === undefined) break;
        imageCache.delete(oldest);
    }
}

/**
 * Devuelve la imagen decodificada para `url` (o `null` mientras carga).
 * `url` vacío → `null` (el llamado pinta su placeholder).
 */
export function useSvgImage(url: string | null): HTMLImageElement | null {
    const [loaded, setLoaded] = useState<{ url: string; image: HTMLImageElement | null } | null>(null);

    useEffect(() => {
        if (!url) return;
        // Cacheado (o ya fallado): el render lo lee de la caché en cuanto
        // cambia la URL, sin pasar por un estado intermedio.
        if (imageCache.has(url)) return;

        const image = new Image();
        image.onload = () => {
            remember(url, image);
            setLoaded({ url, image });
        };
        image.onerror = () => {
            remember(url, null);
            setLoaded({ url, image: null });
        };
        image.src = url;

        return () => {
            image.onload = null;
            image.onerror = null;
        };
    }, [url]);

    if (!url) return null;

    const cached = imageCache.get(url);
    if (cached !== undefined) return cached;

    // Todavía no está la nueva: se pinta la anterior en lugar de un hueco.
    if (loaded?.image) return loaded.image;
    return null;
}
