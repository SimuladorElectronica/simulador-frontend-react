import React from 'react';
import { Group, Circle, Text, Line } from 'react-konva';
import type { ComponentViewProps } from '@domain-types';

export interface LedState {
  isLit: boolean;
  isExploded: boolean;
  color: string;
}

export const LedView: React.FC<ComponentViewProps<LedState>> = ({
  instance,
  onPinClick,
  onDragMove,
}) => {
  const { position, pins, state } = instance;

  const isLit = Boolean(state?.isLit);
  const isExploded = Boolean(state?.isExploded);
  const color = isLit ? (state?.color || '#e74c3c') : '#555555';

  return (
    <Group x={position.x} y={position.y} draggable onDragMove={onDragMove}>
      {isExploded ? (
        <Group>
          <Circle radius={15} fill="#222" />
          <Line points={[-10, -10, 10, 10]} stroke="#ff0000" strokeWidth={3} />
          <Line points={[10, -10, -10, 10]} stroke="#ff0000" strokeWidth={3} />
        </Group>
      ) : (
        <Circle
          radius={12}
          fill={color}
          stroke="#333"
          strokeWidth={2}
          shadowColor={isLit ? color : undefined}
          shadowBlur={isLit ? 15 : 0}
        />
      )}

      {pins.map((pin) => (
        <Group
          key={pin.id}
          x={pin.relativePos.x}
          y={pin.relativePos.y}
          onClick={(e) => onPinClick(pin.id, e)}
        >
          <Circle radius={4} fill="#e67e22" hoverCursor="pointer" />
          <Text text={pin.name} x={6} y={-4} fill="#aaa" fontSize={9} />
        </Group>
      ))}
    </Group>
  );
};