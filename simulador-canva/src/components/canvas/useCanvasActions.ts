import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { CircuitDocument } from '@types';
import { documentStore } from '../../stores/documentStore';
import { PALETTE_DND_MIME } from '../Palette';
import type { Selection } from '../../stores/selectionStore';
import type { CanvasView } from './useCanvasViewport';

type RegisterAddAtCenter = (fn: (type: string) => void) => void;
type SetSelection = (next: Selection) => void;

/** Expone al padre la acción "agregar componente en el centro de la vista". */
export function useAddAtCenter(
    registerAddAtCenter: RegisterAddAtCenter | undefined,
    stageRef: RefObject<Konva.Stage | null>,
    viewRef: RefObject<CanvasView>,
    docRef: RefObject<CircuitDocument>,
    setSelection: SetSelection,
) {
    useEffect(() => {
        if (!registerAddAtCenter) return;
        registerAddAtCenter((type: string) => {
            const stage = stageRef.current;
            if (!stage) return;
            const rect = stage.container().getBoundingClientRect();
            const v = viewRef.current;
            const center = {
                x: (rect.width / 2 - v.x) / v.scale,
                y: (rect.height / 2 - v.y) / v.scale,
            };
            // Pequeño espiral para que varios componentes no queden superpuestos
            const n = docRef.current.components.length;
            const offset = { x: (n % 5) * 24 - 48, y: (n % 5) * 24 - 48 };
            try {
                documentStore.addComponent(type, { x: center.x + offset.x, y: center.y + offset.y });
                setSelection(null);
            } catch {
                // Tipo sin manifiesto registrado: se ignora silenciosamente
            }
        });
    }, [registerAddAtCenter, setSelection, stageRef, viewRef, docRef]);
}

/** Escape cancela el cable en curso; Supr/Backspace borra la selección. */
export function useSelectionShortcuts(
    selection: Selection | null,
    setSelection: SetSelection,
    cancelWiring: () => void,
) {
    const deleteSelection = useCallback(() => {
        if (!selection) return;
        if (selection.kind === 'component') documentStore.removeComponent(selection.id);
        else documentStore.removeWire(selection.id);
        setSelection(null);
    }, [selection, setSelection]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
            if (e.key === 'Escape') {
                cancelWiring();
                setSelection(null);
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelection();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [cancelWiring, deleteSelection, setSelection]);
}

/** Drag & drop desde la paleta al lienzo. */
export function usePaletteDrop(
    wrapperRef: RefObject<HTMLDivElement | null>,
    view: CanvasView,
    setSelection: SetSelection,
) {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData(PALETTE_DND_MIME);
        if (!type) return;
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        const world = {
            x: (e.clientX - rect.left - view.x) / view.scale,
            y: (e.clientY - rect.top - view.y) / view.scale,
        };
        try {
            const inst = documentStore.addComponent(type, world);
            // Solo selecciona el recién soltado; no salta a la pestaña de
            // código (el usuario puede seguir armando el circuito).
            setSelection({ kind: 'component', id: inst.id });
        } catch {
            // Tipo sin manifiesto registrado: se ignora silenciosamente
        }
    };

    return { handleDragOver, handleDrop };
}
