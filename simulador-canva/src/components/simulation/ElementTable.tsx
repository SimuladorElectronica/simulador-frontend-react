import { fmt, type StateEntries } from './simulationModel';

/** Tabla de tensiones/corrientes/potencias por elemento. */
export function ElementTable({ entries }: { entries: StateEntries }) {
    if (entries.length === 0) {
        return <div style={{ color: '#90a4ae' }}>(sin resultados todavía — arma un circuito y pulsa Run)</div>;
    }

    return (
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
                        <td style={{ wordBreak: 'break-all' }}>
                            {id}
                            {s.conducting === true ? ' ●' : ''}
                        </td>
                        <td>{fmt(s.voltage)}</td>
                        <td>{fmt(s.current)}</td>
                        <td>{fmt(s.power)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
