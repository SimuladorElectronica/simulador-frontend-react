import type { ComponentDescriptor } from '../../types/componentDescriptor';
import type { Pin } from '../../../types/simulator';
import { ProtoboardView } from './ProtoboardView';

export const ProtoboardDescriptor: ComponentDescriptor<Record<string, never>> = {
  type: 'PROTOBOARD',
  label: 'Protoboard Standard',
  defaultSize: { width: 360, height: 220 },

  defaultState: {},

  createDefaultPins: (instanceId) => {
    const pins: Pin[] = [];
    const columns = 20;

    for (let col = 0; col < columns; col++) {
      const x = 30 + col * 15;

      // Pistas superiores (A, B, C, D, E)
      ['A', 'B', 'C', 'D', 'E'].forEach((row, rIdx) => {
        pins.push({
          id: `${instanceId}-${row}${col}`,
          name: `${row}${col}`,
          relativePos: { x, y: 60 + rIdx * 8 },
        });
      });

      // Pistas inferiores (F, G, H, I, J)
      ['F', 'G', 'H', 'I', 'J'].forEach((row, rIdx) => {
        pins.push({
          id: `${instanceId}-${row}${col}`,
          name: `${row}${col}`,
          relativePos: { x, y: 125 + rIdx * 8 },
        });
      });
    }

    return pins;
  },

  View: ProtoboardView,

  stepSimulation: ({ state }) => ({
    nextState: state,
    outputs: {},
  }),
};