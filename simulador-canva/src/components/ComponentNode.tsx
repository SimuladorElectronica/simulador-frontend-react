import { Group, Image as KonvaImage, Label, Rect, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import type { ComponentInstance, ComponentManifest, PinReference } from '@types';
import { svgToDataUrl } from './utils/pins';
import { applyVisualRules } from './utils/visualRules';
import { useSvgImage } from './hooks/useSvgImage';
import { useComponentState } from './hooks/useComponentState';
import { useBuzzerAudio } from './hooks/useBuzzerAudio';
import { ComponentPin } from './componentNode/ComponentPin';
import { UnknownComponent } from './componentNode/UnknownComponent';
import { usePressInteraction } from './componentNode/usePressInteraction';

interface ComponentNodeProps {
    instance: ComponentInstance;
    manifest: ComponentManifest | undefined;
    selected: boolean;
    /** Pin desde el que se está trazando un cable (resaltado) */
    wiringFrom: PinReference | null;
    /** Pin sobre el que está el puntero durante el trazado de un cable */
    hoverPin: PinReference | null;
    onSelect: (id: string) => void;
    onStartWiring: (ref: PinReference, evt: Konva.KonvaEventObject<MouseEvent>) => void;
    onPinHover: (ref: PinReference | null) => void;
    onChangePosition: (id: string, x: number, y: number) => void;
}

export function ComponentNode({
    instance,
    manifest,
    selected,
    wiringFrom,
    hoverPin,
    onSelect,
    onStartWiring,
    onPinHover,
    onChangePosition,
}: ComponentNodeProps) {
    // Hooks SIEMPRE en el mismo orden: los dos primeros dependen del id/tipo.
    const workerState = useComponentState(instance.id);
    /** Parámetros del documento ∪ observables del Worker (los últimos mandan) */
    const state = { ...instance.params, ...workerState };
    const art = manifest ? applyVisualRules(manifest.art, manifest.visualRules, state) : null;
    const image = useSvgImage(manifest && art !== null ? svgToDataUrl(art) : null);

    // Audio del zumbador: se activa según el observable `on` del componente.
    const buzzerOn = manifest ? Boolean(state.on) : false;
    useBuzzerAudio(manifest?.id === 'core/buzzer@1' ? instance.id : undefined, manifest?.id, buzzerOn);

    const press = manifest?.interactions?.find((i) => i.gesture === 'press');
    const onPressStart = usePressInteraction(press, instance.id);

    if (!manifest) {
        return (
            <UnknownComponent
                instance={instance}
                selected={selected}
                onSelect={onSelect}
                onChangePosition={onChangePosition}
            />
        );
    }

    const { width, height } = manifest.size;
    const hoveredPin =
        hoverPin && hoverPin.componentId === instance.id
            ? manifest.pins.find((p) => p.id === hoverPin.pinId)
            : undefined;

    const labelWidth = hoveredPin ? hoveredPin.label.length * 7 + 14 : 0;

    return (
        <Group
            x={instance.position.x}
            y={instance.position.y}
            draggable
            onClick={() => onSelect(instance.id)}
            onTap={() => onSelect(instance.id)}
            onMouseDown={onPressStart}
            onDragMove={(e) => onChangePosition(instance.id, e.target.x(), e.target.y())}
            onDragEnd={(e) => onChangePosition(instance.id, e.target.x(), e.target.y())}
        >
            {image ? (
                <KonvaImage image={image} width={width} height={height} />
            ) : (
                <Rect width={width} height={height} fill="#cfd8dc" cornerRadius={4} />
            )}

            {selected && <Rect width={width} height={height} stroke="#1565c0" strokeWidth={2} cornerRadius={4} />}

            <Text
                width={width}
                y={height + 3}
                align="center"
                text={instance.label ?? manifest.displayName}
                fontSize={11}
                fill="#37474f"
            />

            {manifest.pins.map((pin) => (
                <ComponentPin
                    key={pin.id}
                    pin={pin}
                    componentId={instance.id}
                    isOrigin={wiringFrom?.componentId === instance.id && wiringFrom.pinId === pin.id}
                    isHover={hoverPin?.componentId === instance.id && hoverPin.pinId === pin.id}
                    onStartWiring={onStartWiring}
                    onPinHover={onPinHover}
                />
            ))}

            {hoveredPin && (
                <Label
                    x={hoveredPin.position.x <= width / 2 ? hoveredPin.position.x - 8 - labelWidth : hoveredPin.position.x + 8}
                    y={hoveredPin.position.y - 11}
                    listening={false}
                    opacity={0.97}
                >
                    <Tag cornerRadius={4} fill="#ffffff" stroke="#b0bec5" strokeWidth={1} />
                    <Text text={hoveredPin.label} fontSize={10} padding={4} fill="#263238" />
                </Label>
            )}
        </Group>
    );
}
