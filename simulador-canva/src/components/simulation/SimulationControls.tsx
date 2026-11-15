import { simulationClient } from '../../worker/simulationClient';

/** Botones de control de la simulación. */
export function SimulationControls() {
    return (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => simulationClient.control('START')}>▶ Run</button>
            <button onClick={() => simulationClient.control('PAUSE')}>⏸ Pause</button>
            <button onClick={() => simulationClient.control('RESET')}>↺ Reset</button>
            <button onClick={() => simulationClient.control('STEP', 1000)}>⏭ Step 1ms</button>
        </div>
    );
}
