export interface Vector2D {
  x: number;
  y: number;
}

export interface Pin {
  id: string;
  name: string;
  relativePos: Vector2D; // Posición relativa al componente, no absoluta
}

export interface ComponentInstance<TState = Record<string, any>> {
  id: string;
  type: string;
  position: Vector2D;
  pins: Pin[];
  state: TState;
  width?: number;
  height?: number;
}

export interface Wire {
  id: string;
  fromPinId: string;
  toPinId: string;
  color: string;
}