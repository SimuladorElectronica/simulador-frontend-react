import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { selectionStore } from '../stores/selectionStore';
import { normalizeCircuitDocument } from '../services/api';

/** Restaura un proyecto del backend en el lienzo (enlaces y plantillas). */
export function applyProjectToDocument(project: { circuitData: unknown; title: string }) {
    const normalized = normalizeCircuitDocument(project.circuitData, project.title);
    const backendTitle = typeof project.title === 'string' ? project.title.trim() : '';
    if (backendTitle && backendTitle !== normalized.meta.name) {
        normalized.meta = { ...normalized.meta, name: backendTitle };
    }
    documentStore.replaceDocument(normalized);
    // El editor queda apuntando al MCU recién cargado en la próxima selección
    programEditorStore.reset();
    selectionStore.setSelection(null);
}
