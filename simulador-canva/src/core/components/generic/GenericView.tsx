import React from 'react';
import { Group, Rect, Circle, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type { ComponentViewProps } from '@domain-types';

export interface GenericComponentState {
  spriteUrl?: string; // URL opcional de una imagen PNG o SVG
  label?: string;
  color?: string;
  [key: string]: any;
}

export const GenericView: React.FC<ComponentViewProps<GenericComponentState>> = ({
  instance,
  onPinClick,
  onDragMove,
}) => {
  const { position, pins, state, width = 120, height = 90 } = instance;
  const spriteUrl = state?.spriteUrl;

  // Carga asíncrona de la imagen del sprite del usuario
  const [image, status] = useImage(spriteUrl || '', 'anonymous');

  return (
    <Group x={position.x} y={position.y} draggable onDragMove={onDragMove}>
      {/* 1. Fondo: Sprite/Imagen subida o Rectángulo dinámico por defecto */}
      {spriteUrl && status === 'loaded' && image ? (
        <KonvaImage
          image={image}
          width={width}
          height={height}
          shadowColor="black"
          shadowBlur={6}
          shadowOpacity={0.3}
        />
      ) : (
        <Rect
          width={width}
          height={height}
          fill={state?.color || '#34495e'}
          cornerRadius={6}
          stroke="#2c3e50"
          strokeWidth={2}
          shadowColor="black"
          shadowBlur={8}
          shadowOpacity={0.3}
        />
      )}

      {/* Nombre/Título si no hay sprite o mientras se carga */}
      {(!spriteUrl || status !== 'loaded') && (
        <Text
          text={state?.label || instance.type}
          x={5}
          y={10}
          fill="#ffffff"
          fontSize={11}
          fontStyle="bold"
          width={width - 10}
          align="center"
        />
      )}

      {/* 2. Renderizado dinámico de los Pines según sus coordenadas relativas */}
      {pins.map((pin) => (
        <Group
          key={pin.id}
          x={pin.relativePos.x}
          y={pin.relativePos.y}
          onClick={(e) => onPinClick(pin.id, e)}
        >
          {/* Conector interactivo */}
          <Circle
            radius={5}
            fill="#e67e22"
            stroke="#d35400"
            strokeWidth={1}
            hoverCursor="pointer"
          />
          {/* Etiqueta del Pin */}
          <Text
            text={pin.name}
            x={8}
            y={-4}
            fill="#ecf0f1"
            fontSize={9}
            shadowColor="black"
            shadowBlur={2}
          />
        </Group>
      ))}
    </Group>
  );
};