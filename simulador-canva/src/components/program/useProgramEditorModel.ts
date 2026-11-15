import { useMemo, useState } from 'react';
import { useDocument } from '../hooks/useDocument';
import { useProgramEditor } from '../hooks/useProgramEditor';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../../stores/documentStore';
import { simulationClient } from '../../worker/simulationClient';
import { cppSubsetBackend } from '../../core/runtime/cppSubsetBackend';

const isMcuType = (type: string) => !!ManifestRegistry.get(type)?.mcu;

/** MCU objetivo, sketch guardado, diagnósticos y acción de carga del editor. */
export function useProgramEditorModel() {
    const doc = useDocument();
    const editor = useProgramEditor();
    const [status, setStatus] = useState('');

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
    // en programEditorStore; si la placa no tiene programa, no se toca.
    const storedSource = mcu
        ? doc.programs.find((p) => p.mcuComponentId === mcu.id)?.source
        : undefined;

    const source = editor.source;

    // Diagnósticos del subset (sin compilación remota): feedback inmediato.
    const diagnostics = useMemo(
        () => cppSubsetBackend.compile(source, 'esp32@1').diagnostics,
        [source],
    );

    const load = () => {
        if (!mcu) {
            setStatus('⚠ No hay MCU en el circuito (agregá un ESP32)');
            return;
        }
        // 1) Documento: el sketch viaja en la proyección y sobrevive a cambios.
        documentStore.setProgram(mcu.id, source);
        // 2) Worker: compilación/arranque inmediato.
        simulationClient.setProgram(mcu.id, source);
        setStatus(`✓ Programa cargado en ${mcuName} (monitor serie en el panel derecho)`);
    };

    return {
        mcu,
        mcuName,
        storedSource,
        source,
        diagnostics,
        status,
        load,
        editorOpen: editor.isOpen,
    };
}
