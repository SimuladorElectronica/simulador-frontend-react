export type SidebarTab = 'code' | 'components';

/**
 * Pestaña activa de la columna izquierda.
 *
 * Es estado de UI compartido: seleccionar un MCU en el canvas fuerza la
 * pestaña "Código" desde un handler de evento (no desde un efecto).
 */
export class SidebarStore {
    private tab: SidebarTab = 'code';
    private listeners = new Set<() => void>();

    public getTab(): SidebarTab {
        return this.tab;
    }

    public setTab(tab: SidebarTab) {
        if (this.tab === tab) return;
        this.tab = tab;
        this.listeners.forEach((listener) => listener());
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

export const sidebarStore = new SidebarStore();
