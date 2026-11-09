import { useState } from 'react';
import { useDocument } from './hooks/useDocument';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { simulationClient } from '../worker/simulationClient';

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
 * Editor de programa mínimo (textarea) para el sketch Arduino del MCU.
 * Próxima iteración: Monaco editor.
 */
export function ProgramEditor() {
    const doc = useDocument();
    const [source, setSource] = useState(DEFAULT_SKETCH);
    const [status, setStatus] = useState('');

    const mcu = doc.components.find((c) => ManifestRegistry.get(c.type)?.mcu);

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
                borderBottom: '1px solid #cfd8dc',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flexShrink: 0,
            }}
        >
            <h2 style={{ margin: 0, fontSize: 14, color: '#263238' }}>Programa (Arduino)</h2>
            <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
                style={{
                    width: '100%',
                    minHeight: 180,
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: 11,
                    lineHeight: 1.5,
                    padding: 8,
                    boxSizing: 'border-box',
                    border: '1px solid #cfd8dc',
                    borderRadius: 6,
                    resize: 'vertical',
                    background: '#263238',
                    color: '#eceff1',
                }}
            />
            <button
                onClick={load}
                style={{ padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}
            >
                ⤓ Cargar programa en {mcu ? mcu.id : 'MCU'}
            </button>
            {status && <div style={{ fontSize: 11, color: '#546e7a' }}>{status}</div>}
        </section>
    );
}
