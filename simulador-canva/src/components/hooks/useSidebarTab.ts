import { useSyncExternalStore } from 'react';
import { sidebarStore } from '../../stores/sidebarStore';
import type { SidebarTab } from '../../stores/sidebarStore';

/** Pestaña activa de la columna izquierda (Código / Componentes). */
export function useSidebarTab(): SidebarTab {
    return useSyncExternalStore(
        (onChange) => sidebarStore.subscribe(onChange),
        () => sidebarStore.getTab(),
    );
}
