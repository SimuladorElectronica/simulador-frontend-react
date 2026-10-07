import { useEffect, useRef, useState } from 'react';
import type { CircuitNetlist, WorkerEvent } from '@domain-types';

export const useSimulationWorker = (netlist: CircuitNetlist) => {
    const workerRef = useRef<Worker | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        // Instanciar el Web Worker
        const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
            type: 'module',
        });

        worker.onmessage = (e: MessageEvent<WorkerEvent>) => {
            const event = e.data;

            switch (event.type) {
                case 'COMPONENT_BURNED':
                    alert(`🔥 COMPONENTE DESTRUIDO: ${event.payload.reason}`);
                    break;

                case 'BROWNOUT_RESET':
                    console.warn(`⚠️ BROWNOUT RESET: Bajo voltaje detectado (${event.payload.voltage}V)`);
                    break;

                case 'LOG_OUTPUT':
                    setLogs((prev) => [...prev, event.payload.message]);
                    break;
            }
        };

        workerRef.current = worker;

        return () => {
            worker.terminate();
        };
    }, []);

    // Sincronizar cambios en el circuito con el Worker
    useEffect(() => {
        workerRef.current?.postMessage({ type: 'UPDATE_NETLIST', payload: netlist });
    }, [netlist]);

    const startSimulation = () => {
        workerRef.current?.postMessage({ type: 'START' });
        setIsSimulating(true);
    };

    const pauseSimulation = () => {
        workerRef.current?.postMessage({ type: 'PAUSE' });
        setIsSimulating(false);
    };

    return { startSimulation, pauseSimulation, isSimulating, logs };
};