import { Circle, Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { ComponentInstance, ComponentManifest, PinReference } from '@types';
import { PIN_COLORS, svgToDataUrl } from './utils/pins';

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

/** Marcador para componentes cuyo tipo no está registrado en el catálogo */
function UnknownComponent({
    instance,
    selected,
    onSelect,
    onChangePosition,
}: Pick<ComponentNodeProps, 'instance' | 'selected' | 'onSelect' | 'onChangePosition'>) {
    const width = 120;
    const height = 60;
    return (
        <Group
            x={instance.position.x}
            y={instance.position.y}
            draggable
            onClick={() => onSelect(instance.id)}
            onTap={() => onSelect(instance.id)}
            onDragMove={(e) => onChangePosition(instance.id, e.target.x(), e.target.y())}
            onDragEnd={(e) => onChangePosition(instance.id, e.target.x(), e.target.y())}
        >
            <Rect
                width={width}
                height={height}
                fill="#eceff1"
                stroke="#90a4ae"
                strokeWidth={1.5}
                dash={[6, 4]}
                cornerRadius={6}
            />
            <Text
                width={width}
                y={height / 2 - 16}
                align="center"
                text={`¿?\n${instance.type}`}
                fontSize={11}
                fill="#607d8b"
            />
            <Text
                width={width}
                y={height + 2}
                align="center"
                text={instance.label ?? '(tipo desconocido)'}
                fontSize={11}
                fill="#b71c1c"
            />
            {selected && (
                <Rect width={width} height={height} stroke="#1565c0" strokeWidth={2} cornerRadius={6} />
            )}
        </Group>
    );
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
    const [image] = useImage(manifest ? svgToDataUrl(manifest.art) : '');

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

    return (
        <Group
            x={instance.position.x}
            y={instance.position.y}
            draggable
            onClick={() => onSelect(instance.id)}
            onTap={() => onSelect(instance.id)}
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

            {manifest.pins.map((pin) => {
                const ref: PinReference = { componentId: instance.id, pinId: pin.id };
                const isOrigin = wiringFrom?.componentId === instance.id && wiringFrom.pinId === pin.id;
                const isHover = hoverPin?.componentId === instance.id && hoverPin.pinId === pin.id;
                return (
                    <Circle
                        key={pin.id}
                        x={pin.position.x}
                        y={pin.position.y}
                        radius={isOrigin || isHover ? 6 : 4}
                        fill={isOrigin ? '#1565c0' : PIN_COLORS[pin.kind]}
                        stroke={isHover ? '#2e7d32' : '#ffffff'}
                        strokeWidth={isHover ? 3 : 1.5}
                        onMouseDown={(e) => onStartWiring(ref, e)}
                        onMouseEnter={() => onPinHover(ref)}
                        onMouseLeave={() => onPinHover(null)}
                    />
                );
            })}

            {hoveredPin && (
                <Text
                    x={hoveredPin.position.x <= width / 2 ? hoveredPin.position.x - 56 : hoveredPin.position.x + 6}
                    y={hoveredPin.position.y - 16}
                    width={50}
                    align={hoveredPin.position.x <= width / 2 ? 'right' : 'left'}
                    text={hoveredPin.label}
                    fontSize={10}
                    fill="#263238"
                />
            )}
        </Group>
    );
}
