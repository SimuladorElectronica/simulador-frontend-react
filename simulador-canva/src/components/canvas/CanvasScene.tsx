import { Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { RefObject } from 'react';
import type { CircuitDocument, PinReference } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import type { Selection } from '../../stores/selectionStore';
import { ComponentNode } from '../ComponentNode';
import { WireGuide, WireNode } from '../WireNode';
import { resolveGuidePath, resolveWirePath } from '../utils/pins';
import type { CanvasView } from './useCanvasViewport';

interface CanvasSceneProps {
    stageRef: RefObject<Konva.Stage | null>;
    size: { width: number; height: number };
    view: CanvasView;
    doc: CircuitDocument;
    selection: Selection | null;
    wiring: { from: PinReference; pointer: { x: number; y: number } } | null;
    hoverPin: PinReference | null;
    onStageMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onStageMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onStageMouseUp: () => void;
    onStageClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
    onSelectComponent: (id: string) => void;
    onStartWiring: (ref: PinReference, evt: Konva.KonvaEventObject<MouseEvent>) => void;
    onPinHover: (ref: PinReference | null) => void;
    onSelectWire: (id: string) => void;
    onChangePosition: (id: string, x: number, y: number) => void;
}

/** Construye el árbol del Stage de Konva con las capas de componentes y cables. */
export function createCanvasScene({
    stageRef,
    size,
    view,
    doc,
    selection,
    wiring,
    hoverPin,
    onStageMouseDown,
    onStageMouseMove,
    onStageMouseUp,
    onStageClick,
    onWheel,
    onSelectComponent,
    onStartWiring,
    onPinHover,
    onSelectWire,
    onChangePosition,
}: CanvasSceneProps) {
    const guidePath = wiring ? resolveGuidePath(doc, wiring.from, wiring.pointer) : null;

    return (
        <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            x={view.x}
            y={view.y}
            scaleX={view.scale}
            scaleY={view.scale}
            onMouseDown={onStageMouseDown}
            onMouseMove={onStageMouseMove}
            onMouseUp={onStageMouseUp}
            onClick={onStageClick}
            onWheel={onWheel}
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
                        onSelect={onSelectComponent}
                        onStartWiring={onStartWiring}
                        onPinHover={onPinHover}
                        onChangePosition={onChangePosition}
                    />
                ))}
            </Layer>
            {/* Capa superior: cables. Los paths se resuelven acá a partir del
                snapshot y se pasan como props primitivas (ver WireNode). */}
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
                            onSelect={(id) => onSelectWire(id)}
                        />
                    );
                })}
                {wiring && guidePath && <WireGuide d={guidePath} />}
            </Layer>
        </Stage>
    );
}
