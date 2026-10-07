import React from 'react';
import { COMPONENT_REGISTRY } from '@core/registry';
import type { ComponentViewProps } from '@types';

export const ComponentRenderer: React.FC<ComponentViewProps> = (props) => {
  // Busca el descriptor en el registro o usa el genérico si no existe
  const descriptor = COMPONENT_REGISTRY[props.instance.type] || COMPONENT_REGISTRY.GENERIC;
  const ViewComponent = descriptor.View;

  return <ViewComponent {...props} />;
};