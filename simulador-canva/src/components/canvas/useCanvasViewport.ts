import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.08;

export interface CanvasView {
    scale: number;
    x: number;
    y: number;
}

interface PanningState {
    startX: number;
    startY: number;
    origX: number;
    origY: number;
}

/**
 * Tamaño del contenedor, transform de la vista (zoom/pan) y conversión de
 * coordenadas de pantalla a coordenadas de mundo del Stage.
 */
export function useCanvasViewport(
    wrapperRef: RefObject<HTMLDivElement | null>,
    stageRef: RefObject<Konva.Stage | null>,
) {
    const [size, setSize] = useState({ width: 800, height: 600 });
    const [view, setView] = useState<CanvasView>({ scale: 1, x: 40, y: 40 });
    const viewRef = useRef(view);
    const panningRef = useRef<PanningState | null>(null);

    useEffect(() => {
        viewRef.current = view;
    }, [view]);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            setSize({ width: el.clientWidth, height: el.clientHeight });
        });
        ro.observe(el);
        setSize({ width: el.clientWidth, height: el.clientHeight });
        return () => ro.disconnect();
    }, [wrapperRef]);

    const getWorldPointer = useCallback((): { x: number; y: number } => {
        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) return { x: 0, y: 0 };
        return {
            x: (pointer.x - stage.x()) / stage.scaleX(),
            y: (pointer.y - stage.y()) / stage.scaleY(),
        };
    }, [stageRef]);

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) return;

        const oldScale = stage.scaleX();
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP),
        );

        const worldPoint = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };
        setView({
            scale: newScale,
            x: pointer.x - worldPoint.x * newScale,
            y: pointer.y - worldPoint.y * newScale,
        });
    };

    const beginPan = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target !== e.target.getStage()) return;
        panningRef.current = {
            startX: e.evt.clientX,
            startY: e.evt.clientY,
            origX: viewRef.current.x,
            origY: viewRef.current.y,
        };
    };

    const movePan = (e: Konva.KonvaEventObject<MouseEvent>): boolean => {
        const panning = panningRef.current;
        if (!panning) return false;
        setView((v) => ({
            ...v,
            x: panning.origX + (e.evt.clientX - panning.startX),
            y: panning.origY + (e.evt.clientY - panning.startY),
        }));
        return true;
    };

    const endPan = () => {
        panningRef.current = null;
    };

    return { size, view, viewRef, getWorldPointer, handleWheel, beginPan, movePan, endPan };
}
