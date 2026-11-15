import { useState } from 'react';
import { LibraryModal } from './LibraryModal';
import { DEFAULT_SKETCH } from '../core/editor/defaultSketch';
import { programEditorStore } from '../stores/programEditorStore';
import { useProgramEditorModel } from './program/useProgramEditorModel';
import { ProgramEditorContent } from './program/ProgramEditorContent';
import { ProgramEditorSubtitle } from './program/ProgramEditorSubtitle';
import {
    buttonStyle,
    collapsedHintStyle,
    collapsedStyle,
    librariesButtonStyle,
    loadButtonStyle,
    sectionStyle,
    statusStyle,
} from './program/programEditorStyles';

export { DEFAULT_SKETCH };

/**
 * Editor de programa Arduino.
 *
 * - Colapsado por defecto: Monaco NO se descarga hasta que el usuario
 *   pulsa "Abrir editor" o selecciona un ESP32 (carga diferida, ver
 *   `ProgramEditorContent`).
 * - Es siempre el mismo editor: al seleccionar un ESP32 en el canvas se
 *   carga su sketch; si no tiene, se conserva el buffer y el botón de
 *   carga apunta a esa placa.
 */
export function ProgramEditor() {
    const model = useProgramEditorModel();
    const [libraryModalOpen, setLibraryModalOpen] = useState(false);

    return (
        <section style={sectionStyle}>
            <h2 style={{ margin: 0, fontSize: 14, color: '#263238' }}>Programa (Arduino)</h2>
            <ProgramEditorSubtitle
                hasMcu={Boolean(model.mcu)}
                mcuName={model.mcuName}
                storedSource={model.storedSource}
            />

            {model.editorOpen ? (
                <ProgramEditorContent source={model.source} diagnostics={model.diagnostics} />
            ) : (
                <div style={collapsedStyle}>
                    <button onClick={() => programEditorStore.open()} style={buttonStyle}>
                        Abrir editor de código
                    </button>
                    <p style={collapsedHintStyle}>
                        El editor (Monaco) se descarga recién al abrirlo. Al cerrarlo, el código
                        escrito se conserva.
                    </p>
                </div>
            )}

            <button onClick={() => setLibraryModalOpen(true)} style={librariesButtonStyle}>
                📚 Librerías
            </button>
            <button onClick={model.load} style={loadButtonStyle}>
                ⤓ Cargar programa en {model.mcuName}
            </button>
            {model.status && <div style={statusStyle}>{model.status}</div>}

            {libraryModalOpen && <LibraryModal onClose={() => setLibraryModalOpen(false)} />}
        </section>
    );
}
