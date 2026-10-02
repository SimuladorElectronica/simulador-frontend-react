import React from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import type { ComponentViewProps } from '../types';

export const ProtoboardView: React.FC<ComponentViewProps> = ({
  instance,
  onPinClick,
  onDragMove,
}) => {
  const { position, pins } = instance;
  const width = 360;
  const height = 220;

  return (
    <Group x={position.x} y={position.y} draggable onDragMove={onDragMove}>
      {/* Cuerpo Plástico */}
      <Rect
        width={width}
        height={height}
        fill="#f8f9fa"
        cornerRadius={6}
        stroke="#ced4da"
        strokeWidth={2}
        shadowColor="black"
        shadowBlur={8}
        shadowOpacity={0.2}
      />

      {/* Líneas Decorativas de Rieles de Alimentación */}
      {/* Riel Positivo (+) */}
      <Line points={[20, 25, 340, 25]} stroke="#e74c3c" strokeWidth={2} />
      <Text text="+" x={8} y={20} fill="#e74c3c" fontSize={14} fontStyle="bold" />

      {/* Riel Negativo (-) */}
      <Line points={[20, 45, 340, 45]} stroke="#2980b9" strokeWidth={2} />
      <Text text="-" x={10} y={40} fill="#2980b9" fontSize={14} fontStyle="bold" />

      {/* Canal Central Divisor */}
      <Rect x={10} y={105} width={340} height={10} fill="#e9ecef" />

      {/* Renderizado de Matriz de Pines de la Protoboard */}
      {pins.map((pin) => (
        <Group
          key={pin.id}
          x={pin.relativePos.x}
          y={pin.relativePos.y}
          onClick={(e) => onPinClick(pin.id, e)}
        >
          <Rect
            x={-4}
            y={-4}
            width={8}
            height={8}
            fill="#adb5bd"
            stroke="#495057"
            strokeWidth={1}
            cornerRadius={1}
            hoverCursor="pointer"
          />
        </Group>
      ))}
    </Group>
  );
};