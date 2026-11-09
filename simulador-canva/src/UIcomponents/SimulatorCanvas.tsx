import { useCallback, useEffect, useRef, useState } from 'react';
import { Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { PinReference } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { useDocument } from './hooks/useDocument';
import { ComponentNode } from './ComponentNode';
import { WireGuide, WireNode } from './WireNode';
import { PALETTE_DND_MIME } from './Palette';
import { findNearestPin, resolveGuidePath, resolveWirePath } from './utils/pins';

type Selection = { kind: 'component' | 'wire'; id: string } | null;

/** Referencia estable y segura al catálogo (los métodos estáticos no deben perder `this`) */
const getManifest = (type: string) => ManifestRegistry.get(type);

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.08;
/** Radio (en coordenadas de mundo) dentro del cual un pin "engancha" al cablear */
const PIN_SNAP_RADIUS = 12;

interface SimulatorCanvasProps {
    /** El canvas expone un método para que la paleta añada en el centro de la vista */
    registerAddAtCenter?: (fn: (type: string) => void) => void;
}

export function SimulatorCanvas({ registerAddAtCenter }: SimulatorCanvasProps) {
    const doc = useDocument();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);

    const [size, setSize] = useState({ width: 800, height: 600 });
    const [view, setView] = useState({ scale: 1, x: 40, y: 40 });
    const [selection, setSelection] = useState<Selection>(null);
    const [wiring, setWiring] = useState<{ from: PinReference; pointer: { x: number; y: number } } | null>(null);
    const [hoverPin, setHoverPin] = useState<PinReference | null>(null);

    const panningRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const viewRef = useRef(view);
    const docRef = useRef(doc);
    useEffect(() => {
        viewRef.current = view;
        docRef.current = doc;
    }, [view, doc]);

    // ----- Tamaño del contenedor -----
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            setSize({ width: el.clientWidth, height: el.clientHeight });
        });
        ro.observe(el);
        setSize({ width: el.clientWidth, height: el.clientHeight });
        return () => ro.disconnect();
    }, []);

    // ----- Puntero en coordenadas de mundo (aplica el transform del stage) -----
    const getWorldPointer = useCallback((): { x: number; y: number } => {
        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) return { x: 0, y: 0 };
        return {
            x: (pointer.x - stage.x()) / stage.scaleX(),
            y: (pointer.y - stage.y()) / stage.scaleY(),
        };
    }, []);

    // ----- Añadir en el centro de la vista (doble clic en la paleta) -----
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
    }, [registerAddAtCenter]);

    // ----- Selección / borrado con teclado -----
    const deleteSelection = useCallback(() => {
        if (!selection) return;
        if (selection.kind === 'component') documentStore.removeComponent(selection.id);
        else documentStore.removeWire(selection.id);
        setSelection(null);
    }, [selection]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
            if (e.key === 'Escape') {
                setWiring(null);
                setHoverPin(null);
                setSelection(null);
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelection();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [deleteSelection]);

    // ----- Zoom con rueda (hacia el cursor) -----
    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) return;

        const oldScale = stage.scaleX();
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP));

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

    // ----- Pan (arrastrar el fondo) -----
    const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target !== e.target.getStage()) return;
        panningRef.current = {
            startX: e.evt.clientX,
            startY: e.evt.clientY,
            origX: viewRef.current.x,
            origY: viewRef.current.y,
        };
    };

    // ----- Movimiento: pan o previsualización de cable -----
    const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const panning = panningRef.current;
        if (panning) {
            setView((v) => ({
                ...v,
                x: panning.origX + (e.evt.clientX - panning.startX),
                y: panning.origY + (e.evt.clientY - panning.startY),
            }));
        }
        if (wiring) {
            const world = getWorldPointer();
            setWiring((w) => (w ? { ...w, pointer: world } : w));
            setHoverPin(findNearestPin(world, docRef.current.components, getManifest, PIN_SNAP_RADIUS));
        }
    };

    // ----- Soltar: completar cable o terminar el pan -----
    const handleStageMouseUp = () => {
        panningRef.current = null;
        if (!wiring) return;

        const world = getWorldPointer();
        const target = findNearestPin(world, docRef.current.components, getManifest, PIN_SNAP_RADIUS);
        if (target) documentStore.addWire(wiring.from, target);
        setWiring(null);
        setHoverPin(null);
    };

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target === e.target.getStage()) setSelection(null);
    };

    // ----- Trazado de cables desde un pin -----
    const startWiring = (ref: PinReference, evt: Konva.KonvaEventObject<MouseEvent>) => {
        evt.cancelBubble = true;
        setSelection(null);
        setWiring({ from: ref, pointer: getWorldPointer() });
    };

    // ----- Drag & drop desde la paleta -----
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
        const v = view;
        const world = {
            x: (e.clientX - rect.left - v.x) / v.scale,
            y: (e.clientY - rect.top - v.y) / v.scale,
        };
        try {
            const inst = documentStore.addComponent(type, world);
            setSelection({ kind: 'component', id: inst.id });
        } catch {
            // Tipo sin manifiesto registrado: se ignora silenciosamente
        }
    };

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
            <Stage
                ref={stageRef}
                width={size.width}
                height={size.height}
                x={view.x}
                y={view.y}
                scaleX={view.scale}
                scaleY={view.scale}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onClick={handleStageClick}
                onWheel={handleWheel}
            >
                {/* Capa inferior: componentes */}
                <Layer>
                    {doc.components.map((c) => (
                        <ComponentNode
                            key={c.id}
                            instance={c}
                            manifest={ManifestRegistry.get(c.type)}
                            selected={selection?.kind === 'component' && selection.id === c.id}
                            wiringFrom={wiring?.from ?? null}
                            hoverPin={hoverPin}
                            onSelect={(id) => setSelection({ kind: 'component', id })}
                            onStartWiring={startWiring}
                            onPinHover={setHoverPin}
                            onChangePosition={(id, x, y) => documentStore.updateComponentPosition(id, x, y)}
                        />
                    ))}
                </Layer>
                {/* Capa superior: cables, siempre visibles por encima de los componentes.
                    Los paths se resuelven aquí (en el canvas) a partir del snapshot y se
                    pasan como props primitivas: ver el comentario de WireNode. */}
                <Layer>
                    {doc.wires.map((w) => {
                        const d = resolveWirePath(doc, w);
                        if (!d) return null;
                        return (
                            <WireNode
                                key={w.id}
                                wireId={w.id}
                                d={d}
                                color={w.color ?? '#e74c3c'}
                                selected={selection?.kind === 'wire' && selection.id === w.id}
                                onSelect={(id) => setSelection({ kind: 'wire', id })}
                            />
                        );
                    })}
                    {wiring && resolveGuidePath(doc, wiring.from, wiring.pointer) && (
                        <WireGuide d={resolveGuidePath(doc, wiring.from, wiring.pointer)!} />
                    )}
                </Layer>
            </Stage>

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