import type { ComponentDescriptor } from '../../types/componentDescriptor';
import { LedView } from './LedView';
import type { LedState } from './LedView';

export const LedDescriptor: ComponentDescriptor<LedState> = {
  type: 'LED',
  label: 'LED Monocolor',
  defaultSize: { width: 40, height: 40 },

  defaultState: {
    isLit: false,
    isExploded: false,
    color: '#e74c3c',
  },

  createDefaultPins: (instanceId) => [
    { id: `${instanceId}-anode`, name: 'A', relativePos: { x: 10, y: 35 } },
    { id: `${instanceId}-cathode`, name: 'K', relativePos: { x: 30, y: 35 } },
  ],

  // Simplemente referencia la vista del componente
  View: LedView,

  // Lógica física/eléctrica para el Web Worker (Límite 20mA)
  stepSimulation: ({ inputs, state }) => {
    const vAnode = inputs['anode'] || 0;
    const vCathode = inputs['cathode'] || 0;
    const vDiff = vAnode - vCathode;

    if (vDiff > 3.3) {
      return {
        nextState: { ...state, isLit: false, isExploded: true },
        outputs: {},
      };
    }

    return {
      nextState: { ...state, isLit: vDiff >= 1.8 && !state.isExploded },
      outputs: {},
    };
  },
};