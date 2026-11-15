import { fmt, type StateEntries } from './simulationModel';

/** Estados publicados por componente (los que consume el canvas). */
export function ComponentStates({ entries }: { entries: StateEntries }) {
    if (entries.length === 0) {
        return <div style={{ color: '#90a4ae' }}>(el Worker aún no publica estados por componente)</div>;
    }

    return (
        <div style={{ lineHeight: 1.6 }}>
            {entries.map(([id, s]) => (
                <div key={id} style={{ marginBottom: 4 }}>
                    <div style={{ color: '#80cbc4', wordBreak: 'break-all' }}>{id}</div>
                    <div style={{ color: '#b0bec5', wordBreak: 'break-word' }}>
                        {Object.entries(s)
                            .map(([k, v]) => `${k}=${fmt(v)}`)
                            .join(' · ') || '(vacío)'}
                    </div>
                </div>
            ))}
        </div>
    );
}
