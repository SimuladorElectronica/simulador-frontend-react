export type Selection = { kind: 'component' | 'wire'; id: string } | null;

/**
 * Selección actual del canvas, compartida con la columna izquierda.
 *
 * Vive fuera del `DocumentStore` a propósito: la selección es estado de
 * UI (no se persiste ni viaja al Worker). El canvas la escribe y el
 * editor de código la lee para mostrar el sketch del ESP32 elegido.
 */
export class SelectionStore {
    private selection: Selection = null;
    private listeners = new Set<() => void>();

    public getSelection(): Selection {
        return this.selection;
    }

    public setSelection(next: Selection) {
        const current = this.selection;
        if (current === next) return;
        // Misma referencia lógica: evitar notificar de más (re-renders)
        if (current && next && current.kind === next.kind && current.id === next.id) {
            return;
        }
        this.selection = next;
        this.listeners.forEach((listener) => listener());
    }

    public clear() {
        this.setSelection(null);
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

export const selectionStore = new SelectionStore();
