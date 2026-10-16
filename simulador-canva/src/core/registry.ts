import { eraseDescriptor, type AnyComponentDescriptor, type ComponentInstance } from '@domain-types';
import { Esp32Descriptor, ProtoboardDescriptor, LedDescriptor, GenericDescriptor } from './manifests';

// `eraseDescriptor` es el único punto donde se pierde el TState concreto (ver types/componentDescriptor.ts)
export const COMPONENT_REGISTRY: Record<string, AnyComponentDescriptor> = {
  ESP32: eraseDescriptor(Esp32Descriptor),
  PROTOBOARD: eraseDescriptor(ProtoboardDescriptor),
  LED: eraseDescriptor(LedDescriptor),
  GENERIC: eraseDescriptor(GenericDescriptor),
};

// Helper para instanciar un nuevo componente fácilmente en el canvas
export const createComponentInstance = (
  type: string,
  id: string,
  position: { x: number; y: number },
): ComponentInstance => {
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
