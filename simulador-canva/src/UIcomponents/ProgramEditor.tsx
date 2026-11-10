import { Suspense, lazy, useMemo, useState } from 'react';
import { useDocument } from './hooks/useDocument';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { simulationClient } from '../worker/simulationClient';
import { cppSubsetBackend } from '../core/runtime/cppSubsetBackend';

/**
 * Carga diferida: el import dinámico NO se dispara hasta que este
 * componente se renderiza dentro de <Suspense> (solo tras abrir el
 * editor). Así Monaco no se descarga en la carga inicial.
 */
const LazyCodeEditor = lazy(() => import('./CodeEditor'));

export const DEFAULT_SKETCH = `const int LED_PIN = 2;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("ESP32 listo");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(500);
}`;

/**
 * Editor de programa Arduino.
 *
 * - Colapsado por defecto: Monaco NO se descarga hasta que el usuario
 *   pulsa "Abrir editor" (carga diferida, ver `LazyCodeEditor`).
 * - Al abrirse, muestra el editor Monaco con autocompletado Arduino
 *   Core y resaltado C++ exclusivo (lenguaje `cpp`).
 */
export function ProgramEditor() {
    const doc = useDocument();
    const [source, setSource] = useState(DEFAULT_SKETCH);
    const [status, setStatus] = useState('');
    const [editorOpen, setEditorOpen] = useState(false);

    const mcu = doc.components.find((c) => ManifestRegistry.get(c.type)?.mcu);

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
        setStatus(`✓ Programa cargado en ${mcu.id} (monitor serie en el panel derecho)`);
    };

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

            {!editorOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                        onClick={() => setEditorOpen(true)}
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
                            <LazyCodeEditor value={source} onChange={setSource} height="100%" />
                        </div>
                    </Suspense>
                    {diagnostics.length > 0 && (
                        <div
                            data-testid="editor-diagnostics"
                            style={{ fontSize: 11, color: '#b71c1c', flexShrink: 0 }}
                        >
                            {diagnostics.map((d, i) => (
                                <div key={i}>
                                    ⚠ {d.code}: {d.message}
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => setEditorOpen(false)}
                        style={{ padding: '4px 8px', cursor: 'pointer', alignSelf: 'flex-start' }}
                    >
                        Cerrar editor
                    </button>
                </div>
            )}

            <button
                onClick={load}
                style={{ padding: '6px 10px', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
            >
                ⤓ Cargar programa en {mcu ? mcu.id : 'MCU'}
            </button>
            {status && (
                <div style={{ fontSize: 11, color: '#546e7a', flexShrink: 0 }}>{status}</div>
            )}
        </section>
    );
}
