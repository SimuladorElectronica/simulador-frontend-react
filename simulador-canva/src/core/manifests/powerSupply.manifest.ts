import type { ComponentManifest } from '@types';

/**
 * Fuente de alimentación DC regulable (0-24 V).
 *
 * Es la única fuente externa del catálogo: estampa un `voltageSource` y una
 * referencia de tierra, de modo que basta conectarla a la protoboard para
 * alimentar un circuito. La tensión es un PARÁMETRO editable en el inspector
 * (un solo manifiesto, todos los valores posibles).
 */
export const PowerSupplyManifest: ComponentManifest = {
  id: 'core/power-supply@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Fuente DC 0–24 V',
  category: 'Infraestructura',

  size: { width: 120, height: 90 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90">
    <rect x="2" y="2" width="116" height="86" rx="6" fill="#263238" stroke="#37474f" stroke-width="2"/>
    <rect x="10" y="12" width="72" height="34" rx="3" fill="#04121f" stroke="#455a64" stroke-width="1.5"/>
    <text id="readout" x="46" y="37" font-size="18" font-family="monospace" fill="#4cff8f" text-anchor="middle">5.0V</text>
    <text x="46" y="62" font-size="9" font-family="sans-serif" fill="#90a4ae" text-anchor="middle">FUENTE DC</text>
    <text x="46" y="76" font-size="8" font-family="sans-serif" fill="#546e7a" text-anchor="middle">0-24 V</text>
    <circle cx="94" cy="28" r="7" fill="#e74c3c" stroke="#b71c1c" stroke-width="1.5"/>
    <circle cx="94" cy="62" r="7" fill="#eceff1" stroke="#90a4ae" stroke-width="1.5"/>
    <line x1="101" y1="28" x2="112" y2="28" stroke="#78909c" stroke-width="2"/>
    <line x1="101" y1="62" x2="112" y2="62" stroke="#78909c" stroke-width="2"/>
  </svg>`,

  pins: [
    { id: 'vplus', label: '+', position: { x: 112, y: 28 }, kind: 'power' },
    { id: 'gnd', label: '−', position: { x: 112, y: 62 }, kind: 'ground' },
  ],

  elements: [
    {
      id: 'src',
      primitive: 'voltageSource',
      ports: { positive: 'vplus', negative: 'gnd' },
      params: { voltage: 5, outputResistance: 0.01 },
    },
    {
      id: 'gnd_ref',
      primitive: 'groundRef',
      ports: { pin: 'gnd' },
      params: {},
    },
  ],

  parameters: {
    voltage: { type: 'number', label: 'Tensión', min: 0, max: 24, step: 0.1, unit: 'V', default: 5 },
  },

  observables: ['voltage'],

  visualRules: [
    {
      observable: 'voltage',
      property: 'text',
      targetId: 'readout',
      mapping: { type: 'text', decimals: 1, suffix: 'V' },
    },
  ],
};
