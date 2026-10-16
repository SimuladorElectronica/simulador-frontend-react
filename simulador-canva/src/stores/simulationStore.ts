export class SimulationStore {
    private virtualTimeUs: number = 0;
    private observableStates: Record<string, Record<string, unknown>> = {};
    private listeners = new Set<() => void>();

    // Aplica la instantánea incremental emitida por el Worker
    public applySnapshot(virtualTimeUs: number, changes: Record<string, Record<string, unknown>>) {
        this.virtualTimeUs = virtualTimeUs;

        // Fusional incremental (delta)
        Object.entries(changes).forEach(([compId, stateDelta]) => {
            this.observableStates[compId] = {
                ...this.observableStates[compId],
                ...stateDelta,
            };
        });

        this.notify();
    }

    public getComponentState(componentId: string) {
        return this.observableStates[componentId] || {};
    }

    public getVirtualTimeUs() {
        return this.virtualTimeUs;
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach((l) => l());
    }
}

export const simulationStore = new SimulationStore();