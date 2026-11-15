import { useSyncExternalStore } from 'react';
import { programEditorStore } from '../../stores/programEditorStore';
import type { ProgramEditorState } from '../../stores/programEditorStore';

/** Estado compartido del editor de código (MCU objetivo, sketch, apertura). */
export function useProgramEditor(): ProgramEditorState {
    return useSyncExternalStore(
        (onChange) => programEditorStore.subscribe(onChange),
        () => programEditorStore.getState(),
    );
}
