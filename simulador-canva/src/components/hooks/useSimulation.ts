import { useSyncExternalStore } from 'react';
import { simulationStore } from '../../stores/simulationStore';
import type { SimulationSnapshot } from '../../stores/simulationStore';

export function useSimulation(): SimulationSnapshot {
    return useSyncExternalStore(
        (onChange) => simulationStore.subscribe(onChange),
        () => simulationStore.getSnapshot(),
    );
}
