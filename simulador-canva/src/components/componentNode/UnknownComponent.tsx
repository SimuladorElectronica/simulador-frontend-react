import { Group, Rect, Text } from 'react-konva';
import type { ComponentInstance } from '@types';

interface UnknownComponentProps {
    instance: ComponentInstance;
    selected: boolean;
    onSelect: (id: string) => void;
    onChangePosition: (id: string, x: number, y: number) => void;
}

/** Marcador para componentes cuyo tipo no está registrado en el catálogo. */
export function UnknownComponent({
    instance,
    selected,
    onSelect,
    onChangePosition,
}: UnknownComponentProps) {
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
