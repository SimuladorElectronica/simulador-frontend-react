import { useSyncExternalStore } from 'react';

/**
 * Plantilla activa en el lienzo (o null si el documento no proviene de una).
 *
 * Es memoria volátil a propósito: abrir /plantillas/:slug siempre carga una
 * COPIA nueva en memoria; recargar la página reinicia el indicador. Se
 * limpia al cargar un enlace compartido (/p/:slug) y al pedir "Nuevo circuito".
 */
export interface ActiveTemplate {
    slug: string;
    title: string;
}

class TemplateStore {
    private current: ActiveTemplate | null = null;
    private listeners = new Set<() => void>();

    public get(): ActiveTemplate | null {
        return this.current;
    }

    public set(template: ActiveTemplate) {
        this.current = { ...template };
        this.emit();
    }

    public clear() {
        if (this.current === null) return;
        this.current = null;
        this.emit();
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit() {
        this.listeners.forEach((listener) => listener());
    }
}

export const templateStore = new TemplateStore();

export function useActiveTemplate(): ActiveTemplate | null {
    return useSyncExternalStore(
        (onChange) => templateStore.subscribe(onChange),
        () => templateStore.get(),
    );
}
