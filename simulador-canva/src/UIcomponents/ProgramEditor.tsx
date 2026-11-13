import { Suspense, lazy, useMemo, useState } from 'react';
import { useDocument } from './hooks/useDocument';
import { useProgramEditor } from './hooks/useProgramEditor';
import { LibraryModal } from './LibraryModal';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { DEFAULT_SKETCH } from '../core/editor/defaultSketch';
import { programEditorStore } from '../stores/programEditorStore';
import { documentStore } from '../stores/documentStore';
import { simulationClient } from '../worker/simulationClient';
import { cppSubsetBackend } from '../core/runtime/cppSubsetBackend';

export { DEFAULT_SKETCH };

/**
 * Carga diferida: el import dinámico NO se dispara hasta que este
 * componente se renderiza dentro de <Suspense> (solo tras abrir el
 * editor). Así Monaco no se descarga en la carga inicial.
 */
const LazyCodeEditor = lazy(() => import('./CodeEditor'));

const isMcuType = (type: string) => !!ManifestRegistry.get(type)?.mcu;

/**
 * Editor de programa Arduino.
 *
 * - Colapsado por defecto: Monaco NO se descarga hasta que el usuario
 *   pulsa "Abrir editor" o selecciona un ESP32 (carga diferida, ver
 *   `LazyCodeEditor`).
 * - Es siempre el mismo editor: al seleccionar un ESP32 en el canvas se
 *   carga su sketch; si no tiene, se conserva el buffer y el botón de
 *   carga apunta a esa placa.
 * - Al abrirse, muestra el editor Monaco con autocompletado Arduino
 *   Core y resaltado C++ exclusivo (lenguaje `cpp`).
 */
export function ProgramEditor() {
    const doc = useDocument();
    const editor = useProgramEditor();
    const [status, setStatus] = useState('');
    const [libraryModalOpen, setLibraryModalOpen] = useState(false);

    // MCU objetivo: el ESP32 seleccionado en el canvas; si todavía no
    // hay ninguno elegido, el primero del circuito.
    const mcu =
        (editor.targetMcuId
            ? doc.components.find((c) => c.id === editor.targetMcuId)
            : undefined) ?? doc.components.find((c) => isMcuType(c.type));

    const mcuManifest = mcu ? ManifestRegistry.get(mcu.type) : undefined;
    const mcuName = mcu
        ? `${mcu.label ?? mcuManifest?.displayName ?? 'MCU'} (${mcu.id})`
        : 'ningún MCU';

    // Sketch guardado del MCU elegido (si hay). El buffer de edición vive
    // en programEditorStore; si la placa no tiene programa, el buffer no
    // se toca para poder cargárselo tal cual.
    const storedSource = mcu
        ? doc.programs.find((p) => p.mcuComponentId === mcu.id)?.source
        : undefined;

    const source = editor.source;

    // Diagnósticos del subset (sin compilación remota): feedback
    // inmediato en el propio editor.
    const diagnostics = useMemo(
        () => cppSubsetBackend.compile(source, 'esp32@1').diagnostics,
        [source],
    );

    const load = () => {
        if (!mcu) {
            setStatus('⚠ No hay MCU en el circuito (agregá un ESP32)');
            return;
        }
        // 1) Documento: el sketch viaja en la proyección y sobrevive a cambios de circuito
        documentStore.setProgram(mcu.id, source);
        // 2) Worker: compilación/arranque inmediato (sin esperar al próximo render)
        simulationClient.setProgram(mcu.id, source);
        setStatus(`✓ Programa cargado en ${mcuName} (monitor serie en el panel derecho)`);
    };

    const editorOpen = editor.isOpen;

    return (
        <section
            style={{
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flex: 1,
                minHeight: 0,
                boxSizing: 'border-box',
            }}
        >
            <h2 style={{ margin: 0, fontSize: 14, color: '#263238' }}>Programa (Arduino)</h2>
            <div style={{ fontSize: 11, color: '#546e7a', marginTop: -4 }}>
                {mcu ? (
                    <>
                        MCU seleccionado: <strong>{mcuName}</strong>
                        {storedSource === undefined ? ' · sin programa guardado' : ''}
                    </>
                ) : (
                    'Sin MCU en el circuito'
                )}
            </div>

            {!editorOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                        onClick={() => programEditorStore.open()}
                        style={{ padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Abrir editor de código
                    </button>
                    <p style={{ margin: 0, fontSize: 11, color: '#78909c', lineHeight: 1.4 }}>
                        El editor (Monaco) se descarga recién al abrirlo. Al cerrarlo, el código
                        escrito se conserva.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                    <Suspense
                        fallback={
                            <div
                                style={{
                                    padding: 12,
                                    background: '#263238',
                                    color: '#eceff1',
                                    borderRadius: 6,
                                }}
                            >
                                Cargando editor (Monaco se descarga recién ahora)…
                            </div>
                        }
                    >
                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                border: '1px solid #263238',
                                borderRadius: 6,
                                overflow: 'hidden',
                            }}
                        >
                            <LazyCodeEditor
                                value={source}
                                onChange={(v) => programEditorStore.setSource(v)}
                                height="100%"
                            />
                        </div>
                    </Suspense>
                    {diagnostics.length > 0 && (
                        <div
                            data-testid="editor-diagnostics"
                            style={{ flexShrink: 0 }}
                        >
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
                    <button
                        onClick={() => programEditorStore.close()}
                        style={{ padding: '4px 8px', cursor: 'pointer', alignSelf: 'flex-start' }}
                    >
                        Cerrar editor
                    </button>
                </div>
            )}

            <button
                onClick={() => setLibraryModalOpen(true)}
                style={{ padding: '6px 10px', cursor: 'pointer', width: '100%', flexShrink: 0 }}
            >
                📚 Librerías
            </button>
            <button
                onClick={load}
                style={{ padding: '6px 10px', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
            >
                ⤓ Cargar programa en {mcuName}
            </button>
            {status && (
                <div style={{ fontSize: 11, color: '#546e7a', flexShrink: 0 }}>{status}</div>
            )}

            {libraryModalOpen && <LibraryModal onClose={() => setLibraryModalOpen(false)} />}
        </section>
    );
}
