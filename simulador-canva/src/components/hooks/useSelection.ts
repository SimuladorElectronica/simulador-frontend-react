import { useSyncExternalStore } from 'react';
import { selectionStore } from '../../stores/selectionStore';
import type { Selection } from '../../stores/selectionStore';

/** Selección actual del canvas (componente o cable). */
export function useSelection(): Selection {
    return useSyncExternalStore(
        (onChange) => selectionStore.subscribe(onChange),
        () => selectionStore.getSelection(),
    );
}
