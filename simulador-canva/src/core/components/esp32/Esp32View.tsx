import React from 'react';
import { Group, Rect, Circle, Text } from 'react-konva';
import type { ComponentViewProps } from '@types';
import type { Esp32State } from './esp32.descriptor';

export const Esp32View: React.FC<ComponentViewProps<Esp32State>> = ({
  instance,
  onPinClick,
  onDragMove,
}) => {
  const { position, pins, state } = instance;
  const width = 140;
  const height = 260;

  const isPowered = Boolean(state?.isPowered);

  return (
    <Group x={position.x} y={position.y} draggable onDragMove={onDragMove}>
      {/* Placa PCB Principal */}
      <Rect
        width={width}
        height={height}
        fill="#1a252f"
        cornerRadius={8}
        stroke="#2c3e50"
        strokeWidth={2}
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.4}
      />

      {/* Módulo de Metal / Antena ESP32 */}
      <Rect
        x={25}
        y={15}
        width={80}
        height={80}
        fill="#bdc3c7"
        cornerRadius={4}
        stroke="#7f8c8d"
        strokeWidth={1}
      />
      <Text text="ESP-WROOM-32" x={30} y={45} fontSize={10} fill="#2c3e50" fontStyle="bold" />

      {/* Puerto Micro-USB */}
      <Rect x={45} y={245} width={50} height={15} fill="#7f8c8d" cornerRadius={2} />

      {/* LED de Encendido / Estado */}
      <Circle
        x={30}
        y={110}
        radius={4}
        fill={isPowered ? '#2ecc71' : '#7f8c8d'}
        shadowColor="#2ecc71"
        shadowBlur={isPowered ? 8 : 0}
      />
      <Text text="PWR" x={38} y={106} fontSize={8} fill="#ecf0f1" />

      {/* Texto de Identificación */}
      <Text text="ESP32 DevKit v1" x={25} y={130} fontSize={12} fill="#ecf0f1" fontStyle="bold" />

      {/* Renderizado Dinámico de Pines (30 Pines) */}
      {pins.map((pin) => {
        const isLeftColumn = pin.relativePos.x < width / 2;
        return (
          <Group
            key={pin.id}
            x={pin.relativePos.x}
            y={pin.relativePos.y}
            onClick={(e) => onPinClick(pin.id, e)}
          >
            {/* Header / Pad metálico del Pin */}
            <Rect x={-5} y={-5} width={10} height={10} fill="#f39c12" cornerRadius={1} />
            <Circle radius={3} fill="#2c3e50" hoverCursor="pointer" />

            {/* Etiqueta del Pin */}
            <Text
              text={pin.name}
              x={isLeftColumn ? 10 : -35}
              y={-4}
              fill="#bdc3c7"
              fontSize={9}
              align={isLeftColumn ? 'left' : 'right'}
              width={30}
            />
          </Group>
        );
      })}
    </Group>
  );
};