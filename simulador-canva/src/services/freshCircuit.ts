/**
 * Arranque en blanco del simulador.
 *
 * Se usa desde:
 * - `ShareCircuit` ("Nuevo circuito vacío", con confirmación).
 * - `App` cuando se abre `/new` o `/…?new=1` (p. ej. tal como enlaza el
 *   dashboard: "Nuevo proyecto" abre el simulador con la sesión de la cuenta
 *   y un lienzo vacío, sin cargar el proyecto recordado).
 *
 * Además de vaciar el documento, OLVIDA la referencia al proyecto guardado
 * (`projectStore`): sin esto, el primer "Guardar" editaría el último proyecto
 * recordado en lugar de crear uno nuevo en la cuenta.
 */
import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { selectionStore } from '../stores/selectionStore';
import { projectStore } from '../stores/projectStore';

export const FRESH_CIRCUIT_NAME = 'Proyecto Sin Título';

export function startFreshCircuit(): void {
    documentStore.replaceDocument({
        formatVersion: 1,
        components: [],
        wires: [],
        programs: [],
        meta: { name: FRESH_CIRCUIT_NAME, createdAt: Date.now(), updatedAt: Date.now() },
    });
    programEditorStore.reset();
    selectionStore.setSelection(null);
    projectStore.clear();
}
