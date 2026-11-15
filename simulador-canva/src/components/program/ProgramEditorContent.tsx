import { Suspense, lazy } from 'react';
import type { CodeDiagnostic } from '../../types/execution';
import { programEditorStore } from '../../stores/programEditorStore';
import { closeButtonStyle, editorFrameStyle, fallbackStyle } from './programEditorStyles';

/**
 * Carga diferida: el import dinámico NO se dispara hasta que este
 * componente se renderiza dentro de <Suspense> (solo tras abrir el
 * editor). Así Monaco no se descarga en la carga inicial.
 */
const LazyCodeEditor = lazy(() => import('../CodeEditor'));

interface ProgramEditorContentProps {
    source: string;
    diagnostics: CodeDiagnostic[];
}

/** Editor Monaco ya abierto, con sus diagnósticos y el botón de cierre. */
export function ProgramEditorContent({ source, diagnostics }: ProgramEditorContentProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
            <Suspense fallback={<div style={fallbackStyle}>Cargando editor (Monaco se descarga recién ahora)…</div>}>
                <div style={editorFrameStyle}>
                    <LazyCodeEditor
                        value={source}
                        onChange={(v) => programEditorStore.setSource(v)}
                        height="100%"
                    />
                </div>
            </Suspense>
            {diagnostics.length > 0 && (
                <div data-testid="editor-diagnostics" style={{ flexShrink: 0 }}>
                    {diagnostics.map((d, i) => (
                        <div
                            key={i}
                            style={{
                                fontSize: 11,
                                color: d.severity === 'warning' ? '#ef6c00' : '#b71c1c',
                            }}
                        >
                            ⚠ {d.code}: {d.message}
                        </div>
                    ))}
                </div>
            )}
            <button onClick={() => programEditorStore.close()} style={closeButtonStyle}>
                Cerrar editor
            </button>
        </div>
    );
}
