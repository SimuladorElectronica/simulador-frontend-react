import { useEffect, useRef } from 'react';
import { simulationClient } from '../../worker/simulationClient';

/**
 * Interacción `press` (pulsador): mousedown activa y el mouseup/touchend
 * global lo libera aunque el puntero haya salido del componente.
 */
export function usePressInteraction(
    press: { name: string } | undefined,
    componentId: string,
) {
    const pressingRef = useRef(false);

    useEffect(() => {
        if (!press) return;
        const release = () => {
            if (!pressingRef.current) return;
            pressingRef.current = false;
            simulationClient.interact(componentId, press.name, false);
        };
        window.addEventListener('mouseup', release);
        window.addEventListener('touchend', release);
        return () => {
            window.removeEventListener('mouseup', release);
            window.removeEventListener('touchend', release);
        };
    }, [press, componentId]);

    return () => {
        if (!press || pressingRef.current) return;
        pressingRef.current = true;
        simulationClient.interact(componentId, press.name, true);
    };
}
