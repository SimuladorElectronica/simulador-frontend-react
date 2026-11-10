import { useSimulation } from './hooks/useSimulation';
import { simulationClient } from '../worker/simulationClient';
import { simulationStore } from '../stores/simulationStore';
import { SerialConsole } from './SerialConsole';

const fmt = (v: unknown) =>
    typeof v === 'number' ? Number(v.toPrecision(4)).toString() : String(v ?? '—');

/**
 * Panel de simulación (MVP): controles de ejecución y resultados en texto. Todo sale de simulationStore (alimentado por el worker vía simulationClient).
 */
export function SimulationPanel() {
    const sim = useSimulation();
    const entries = Object.entries(sim.states);

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
            <h2 style={{ margin: '0 0 8px', fontSize: 13 }}>Simulación</h2>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <button onClick={() => simulationClient.control('START')}>▶ Run</button>
                <button onClick={() => simulationClient.control('PAUSE')}>⏸ Pause</button>
                <button onClick={() => simulationClient.control('RESET')}>↺ Reset</button>
                <button onClick={() => simulationClient.control('STEP', 1000)}>⏭ Step 1ms</button>
            </div>

            <div style={{ marginBottom: 10, lineHeight: 1.6 }}>
                <div>estado: <strong>{sim.status}</strong></div>
                <div>t_virtual: {sim.virtualTimeUs} µs · seq #{sim.lastSeq}</div>
                <div>
                    solver:{' '}
                    {sim.converged === null ? '—' : sim.converged ? `converge en ${sim.iterations} iter` : 'NO converge'}
                    {sim.diagnostics.length > 0 && ` · ⚠ ${sim.diagnostics.join(', ')}`}
                </div>
            </div>

            <h3 style={{ margin: '10px 0 4px', fontSize: 11 }}>Elementos (V / I / P)</h3>
            {entries.length === 0 ? (
                <div style={{ color: '#90a4ae' }}>(sin resultados todavía — arma un circuito y pulsa Run)</div>
            ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr style={{ color: '#90a4ae', textAlign: 'left' }}>
                            <th>elemento</th>
                            <th>V</th>
                            <th>I</th>
                            <th>P</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(([id, s]) => (
                            <tr key={id}>
                                <td style={{ wordBreak: 'break-all' }}>{id}{s.conducting === true ? ' ●' : ''}</td>
                                <td>{fmt(s.voltage)}</td>
                                <td>{fmt(s.current)}</td>
                                <td>{fmt(s.power)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <div style={{ marginTop: 14 }}>
                <SerialConsole entries={sim.serial} onClear={() => simulationStore.clearSerial()} />
            </div>

            <h3 style={{ margin: '14px 0 4px', fontSize: 11 }}>Log (también en consola)</h3>
            <pre
                style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 260,
                    overflowY: 'auto',
                    color: '#b0bec5',
                }}
            >
                {sim.log.map((l) => `[${l.timeUs}us] ${l.text}`).join('\n') || '(vacío)'}
            </pre>
        </aside>
    );
}
