import type { SimulationSnapshot } from '../../stores/simulationStore';

function solverText(sim: SimulationSnapshot): string {
    if (sim.converged === null) return '—';
    return sim.converged ? `converge en ${sim.iterations} iter` : 'NO converge';
}

/** Resumen del estado y el solver de la simulación. */
export function SimulationSummary({ sim }: { sim: SimulationSnapshot }) {
    return (
        <div style={{ marginBottom: 10, lineHeight: 1.6 }}>
            <div>
                estado: <strong>{sim.status}</strong>
            </div>
            <div>
                t_virtual: {sim.virtualTimeUs} µs · seq #{sim.lastSeq}
            </div>
            <div>
                solver: {solverText(sim)}
                {sim.diagnostics.length > 0 && ` · ⚠ ${sim.diagnostics.join(', ')}`}
            </div>
        </div>
    );
}
