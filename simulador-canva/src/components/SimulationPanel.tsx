import { useSimulation } from './hooks/useSimulation';
import { simulationStore } from '../stores/simulationStore';
import { SerialConsole } from './SerialConsole';
import { MqttMonitor } from './MqttMonitor';
import { ShareCircuit } from './ShareCircuit';
import { AccountPanel } from './AccountPanel';
import { SimulationControls } from './simulation/SimulationControls';
import { SimulationSummary } from './simulation/SimulationSummary';
import { ElementTable } from './simulation/ElementTable';
import { ComponentStates } from './simulation/ComponentStates';
import { SimulationLog } from './simulation/SimulationLog';
import { splitEntries } from './simulation/simulationModel';

/**
 * Panel de simulación (MVP): controles de ejecución y resultados en texto.
 * Todo sale de simulationStore (alimentado por el worker vía simulationClient).
 */
export function SimulationPanel() {
    const sim = useSimulation();
    const { elementEntries, componentEntries } = splitEntries(sim.states);

    return (
        <aside
            style={{
                width: 300,
                flexShrink: 0,
                background: '#263238',
                color: '#eceff1',
                overflowY: 'auto',
                padding: 12,
                boxSizing: 'border-box',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 11,
            }}
        >
            <AccountPanel />
            <ShareCircuit />

            <h2 style={{ margin: '0 0 8px', fontSize: 13 }}>Simulación</h2>
            <SimulationControls />
            <SimulationSummary sim={sim} />

            <h3 style={{ margin: '10px 0 4px', fontSize: 11 }}>Elementos (V / I / P)</h3>
            <ElementTable entries={elementEntries} />

            <h3 style={{ margin: '12px 0 4px', fontSize: 11 }}>Estados de componente</h3>
            <ComponentStates entries={componentEntries} />

            <div style={{ marginTop: 14 }}>
                <SerialConsole entries={sim.serial} onClear={() => simulationStore.clearSerial()} />
            </div>

            <div style={{ marginTop: 14 }}>
                <MqttMonitor />
            </div>

            <h3 style={{ margin: '14px 0 4px', fontSize: 11 }}>Log (también en consola)</h3>
            <SimulationLog entries={sim.log} />
        </aside>
    );
}
