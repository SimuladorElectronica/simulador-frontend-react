import { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { selectionStore } from '../stores/selectionStore';
import type { Selection } from '../stores/selectionStore';
import { programEditorStore } from '../stores/programEditorStore';
import { useDocument } from './hooks/useDocument';
import { useSelection } from './hooks/useSelection';
import { ComponentInspector } from './ComponentInspector';
import { createCanvasScene } from './canvas/CanvasScene';
import { useCanvasViewport } from './canvas/useCanvasViewport';
import { useWiring } from './canvas/useWiring';
import { useAddAtCenter, usePaletteDrop, useSelectionShortcuts } from './canvas/useCanvasActions';

interface SimulatorCanvasProps {
    /** El canvas expone un método para que la paleta añada en el centro de la vista */
    registerAddAtCenter?: (fn: (type: string) => void) => void;
}

export function SimulatorCanvas({ registerAddAtCenter }: SimulatorCanvasProps) {
    const doc = useDocument();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);

    const { size, view, viewRef, getWorldPointer, handleWheel, beginPan, movePan, endPan } =
        useCanvasViewport(wrapperRef, stageRef);

    // La selección es compartida con la columna izquierda (editor de código)
    const selection = useSelection();
    const setSelection = useCallback((next: Selection) => selectionStore.setSelection(next), []);

    const docRef = useRef(doc);
    useEffect(() => {
        docRef.current = doc;
    }, [doc]);

    const { wiring, hoverPin, setHoverPin, startWiring, moveWiring, finishWiring, cancelWiring } =
        useWiring({ docRef, getWorldPointer, onClearSelection: () => setSelection(null) });

    /**
     * Selecciona un componente. Si es un MCU (ESP32), además fija el
     * destino del editor de código y abre su pestaña para mostrar el
     * sketch guardado (o el buffer actual si no tiene programa).
     */
    const selectComponent = useCallback(
        (id: string) => {
            setSelection({ kind: 'component', id });
            const componentType = docRef.current.components.find((c) => c.id === id)?.type;
            if (componentType && ManifestRegistry.get(componentType)?.mcu) {
                programEditorStore.selectMcu(id);
            }
        },
        [setSelection],
    );

    // ----- Añadir en el centro de la vista (doble clic en la paleta) -----
    useAddAtCenter(registerAddAtCenter, stageRef, viewRef, docRef, setSelection);

    // ----- Selección / borrado con teclado -----
    useSelectionShortcuts(selection, setSelection, cancelWiring);

    // ----- Movimiento: pan o previsualización de cable -----
    const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        movePan(e);
        if (wiring) moveWiring();
    };

    // ----- Soltar: completar cable o terminar el pan -----
    const handleStageMouseUp = () => {
        endPan();
        finishWiring();
    };

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target === e.target.getStage()) setSelection(null);
    };

    // ----- Drag & drop desde la paleta -----
    const { handleDragOver, handleDrop } = usePaletteDrop(wrapperRef, view, setSelection);

    return (
        <div
            ref={wrapperRef}
            style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                background: '#eceff1',
                cursor: wiring ? 'crosshair' : 'default',
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {createCanvasScene({
                stageRef,
                size,
                view,
                doc,
                selection,
                wiring,
                hoverPin,
                onStageMouseDown: beginPan,
                onStageMouseMove: handleStageMouseMove,
                onStageMouseUp: handleStageMouseUp,
                onStageClick: handleStageClick,
                onWheel: handleWheel,
                onSelectComponent: selectComponent,
                onStartWiring: startWiring,
                onPinHover: setHoverPin,
                onSelectWire: (id) => setSelection({ kind: 'wire', id }),
                onChangePosition: (id, x, y) => documentStore.updateComponentPosition(id, x, y),
            })}

            <ComponentInspector />

            <div
                style={{
                    position: 'absolute',
                    left: 10,
                    bottom: 10,
                    padding: '6px 10px',
                    background: 'rgba(255,255,255,0.85)',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#546e7a',
                    pointerEvents: 'none',
                }}
            >
                Rueda: zoom · Arrastra el fondo: mover vista · Arrastra de un pin a otro: cable · Supr: borrar · Esc: cancelar
            </div>
        </div>
    );
}
