import { useSyncExternalStore } from 'react';
import { simulationStore } from '../../stores/simulationStore';

/**
 * Estado publicado por el Worker para un componente (clave = `componentId`,
 * sin `:`). Se suscribe al store de simulación: cada SNAPSHOT con cambios
 * para ese componente re-renderiza el consumidor.
 *
 * El objeto vacío es una referencia ESTABLE: `useSyncExternalStore` compara
 * con `Object.is` y un `{}` nuevo en cada snapshot provocaría bucles de
 * render (o el warning "getSnapshot should be cached").
 */
const EMPTY_STATE: Record<string, unknown> = {};

export function useComponentState(componentId: string): Record<string, unknown> {
    return useSyncExternalStore(
        (onStoreChange) => simulationStore.subscribe(onStoreChange),
        () => simulationStore.getComponentState(componentId) ?? EMPTY_STATE,
        () => EMPTY_STATE,
    );
}
