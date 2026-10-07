import Konva from 'konva';
import type { ComponentInstance } from './basicElements';

export interface ComponentViewProps<TState = any> {
  instance: ComponentInstance<TState>;
  onPinClick: (pinId: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
}