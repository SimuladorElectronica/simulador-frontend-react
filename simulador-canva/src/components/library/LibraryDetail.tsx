import type { LibraryDefinition } from '../../core/libraries/types';

/** Detalle de la librería seleccionada en el panel derecho del modal. */
export function LibraryDetail({ library }: { library: LibraryDefinition }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
                <h3 style={{ margin: '0 0 2px', fontSize: 13 }}>{library.displayName}</h3>
                <div style={{ fontSize: 10, color: '#78909c' }}>{library.category}</div>
            </div>
            <p style={{ margin: 0, lineHeight: 1.45 }}>{library.description}</p>

            <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                    Headers
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {library.headers.map((header) => (
                        <code
                            key={header}
                            style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#eceff1',
                                fontSize: 11,
                            }}
                        >
                            {`#include <${header}>`}
                        </code>
                    ))}
                </div>
            </div>

            {library.constructorSignature && (
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                        Declaración
                    </div>
                    <code
                        style={{
                            display: 'block',
                            padding: '6px 8px',
                            borderRadius: 4,
                            background: '#263238',
                            color: '#eceff1',
                            fontSize: 11,
                            wordBreak: 'break-word',
                        }}
                    >
                        {library.constructorSignature}
                    </code>
                </div>
            )}

            <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                    Métodos
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {library.methods.map((method) => (
                        <li
                            key={method.name}
                            style={{ borderBottom: '1px solid #f0f4f5', padding: '4px 0' }}
                        >
                            <code style={{ fontSize: 11 }}>{method.signature}</code>
                            <div style={{ fontSize: 10, color: '#78909c', lineHeight: 1.4 }}>
                                {method.documentation}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                    Ejemplo
                </div>
                <pre
                    style={{
                        margin: 0,
                        padding: 8,
                        borderRadius: 6,
                        background: '#263238',
                        color: '#eceff1',
                        fontSize: 10.5,
                        lineHeight: 1.45,
                        overflowX: 'auto',
                        whiteSpace: 'pre',
                    }}
                >
                    {library.example}
                </pre>
            </div>
        </div>
    );
}
