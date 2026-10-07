import type { ComponentDescriptor } from '@domain-types';
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

  View: LedView,

  // Lógica física/eléctrica tolerante y desacoplada
  stepSimulation: ({ componentId, pinVoltages, inputs = pinVoltages || {}, state }) => {
    // Resolver el voltaje usando el ID real del pin o fallback corto
    const vAnode = inputs[`${componentId}-anode`] ?? inputs['anode'] ?? 0;
    const vCathode = inputs[`${componentId}-cathode`] ?? inputs['cathode'] ?? 0;
    const vDiff = vAnode - vCathode;

    if (vDiff > 3.3) {
      return {
        nextState: { ...state, isLit: false, isExploded: true },
        outputs: {},
      };
    }

    return {
      nextState: { ...state, isLit: vDiff >= 1.8 && !state?.isExploded },
      outputs: {},
    };
  },
};