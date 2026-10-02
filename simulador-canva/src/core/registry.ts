import type { ComponentDescriptor } from './types/componentDescriptor';
import { Esp32Descriptor, ProtoboardDescriptor, LedDescriptor, GenericDescriptor} from './components';

export const COMPONENT_REGISTRY: Record<string, ComponentDescriptor<any>> = {
  ESP32: Esp32Descriptor,
  PROTOBOARD: ProtoboardDescriptor,
  LED: LedDescriptor,
  GENERIC: GenericDescriptor,
};

// Helper para instanciar un nuevo componente fácilmente en el canvas
export const createComponentInstance = (type: string, id: string, position: { x: number; y: number }) => {
  const descriptor = COMPONENT_REGISTRY[type];
  if (!descriptor) throw new Error(`Componente no soportado: ${type}`);

  return {
    id,
    type,
    position,
    pins: descriptor.createDefaultPins(id),
    state: { ...descriptor.defaultState },
    width: descriptor.defaultSize.width,
    height: descriptor.defaultSize.height,
  };
};