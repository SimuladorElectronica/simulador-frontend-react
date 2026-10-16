import type { ComponentManifest } from '@types';

export const LedManifest: ComponentManifest = {
  id: 'core/led@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'LED Monocolor 5mm',
  category: 'Salidas',
  size: { width: 40, height: 40 },
  art: `<svg viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="12" fill="#e74c3c" stroke="#333" stroke-width="2"/>
  </svg>`,
  pins: [
    { id: 'anode', label: 'A', position: { x: 10, y: 35 }, kind: 'passive' },
    { id: 'cathode', label: 'K', position: { x: 30, y: 35 }, kind: 'passive' },
  ],
  elements: [
    {
      id: 'd1',
      primitive: 'led',
      ports: { anode: 'anode', cathode: 'cathode' },
      params: { forwardVoltage: 1.8, seriesResistance: 10, nominalCurrent: 0.02 },
    },
  ],
  monitors: [
    {
      element: 'd1',
      quantity: 'power',
      comparison: 'above',
      limit: 0.06,           // 60 mW
      duration: 1500000,     // 1.5 s en us virtuales
      event: 'LED_BURNED',
      action: 'destroy',
    },
  ],
  parameters: {
    color: { type: 'enum', default: '#e74c3c' },
  },
  observables: ['brightness', 'burned'],
  visualRules: [
    { observable: 'brightness', property: 'shadowBlur', mapping: { type: 'linear', min: 0, max: 15 } },
  ],
};