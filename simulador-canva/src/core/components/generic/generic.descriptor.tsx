import type { ComponentDescriptor } from '../../types/componentDescriptor';
import { GenericView } from './GenericView';
import type { GenericComponentState } from './GenericView';

export const GenericDescriptor: ComponentDescriptor<GenericComponentState> = {
  type: 'GENERIC',
  label: 'Componente Genérico',
  defaultSize: { width: 120, height: 90 },

  defaultState: {
    label: 'Genérico',
    color: '#34495e',
    spriteUrl: '',
  },

  // Los pines iniciales de un componente genérico se definen dinámicamente según la instancia
  createDefaultPins: () => [],

  View: GenericView,

  stepSimulation: ({ state }) => ({
    nextState: state,
    outputs: {},
  }),
};