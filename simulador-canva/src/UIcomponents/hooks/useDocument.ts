import { useSyncExternalStore } from 'react';
import type { CircuitDocument } from '@types';
import { documentStore } from '../../stores/documentStore';

/**
 * Suscribe el componente a los cambios del DocumentStore usando el snapshot
 * inmutable (`getSnapshot`). Su referencia solo cambia cuando el documento
 * cambia, requisito de `useSyncExternalStore` y lo que permite que React
 * Compiler memoice sin perder actualizaciones (arrastres, nuevos cables…).
 */
export function useDocument(): CircuitDocument {
    return useSyncExternalStore(
        (onChange) => documentStore.subscribe(onChange),
        () => documentStore.getSnapshot(),
    );
}
