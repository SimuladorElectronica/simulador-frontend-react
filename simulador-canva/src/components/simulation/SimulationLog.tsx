import type { SimLogEntry } from '../../stores/simulationStore';

/** Log textual de la simulación. */
export function SimulationLog({ entries }: { entries: SimLogEntry[] }) {
    return (
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
            {entries.map((l) => `[${l.timeUs}us] ${l.text}`).join('\n') || '(vacío)'}
        </pre>
    );
}
