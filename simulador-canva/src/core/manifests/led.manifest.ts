import type { ComponentManifest } from '@types';

/**
 * LED monocolor 5 mm.
 *
 * El estado visual sale del SNAPSHOT del Worker: `brightness` (derivada de
 * la corriente que atraviesa el elemento) controla la opacidad del domo y
 * del halo, `burned` dibuja la cruz de quemado y `color` (parámetro) pinta
 * la carcasa. Un solo manifiesto para cualquier color.
 */
export const LedManifest: ComponentManifest = {
  id: 'core/led@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'LED Monocolor 5mm',
  category: 'Salidas',
  size: { width: 40, height: 40 },
  art: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <line x1="10" y1="36" x2="10" y2="27" stroke="#90a4ae" stroke-width="2"/>
    <line x1="30" y1="36" x2="30" y2="27" stroke="#90a4ae" stroke-width="2"/>
    <circle id="glow" cx="20" cy="18" r="17" fill="#ff8a80" opacity="0"/>
    <circle id="lamp-off" cx="20" cy="18" r="12" fill="#7f1d1d" stroke="#4a1010" stroke-width="1.5"/>
    <circle id="lamp" cx="20" cy="18" r="12" fill="#e74c3c" stroke="#4a1010" stroke-width="1.5" opacity="0"/>
    <g id="burned-mark" opacity="0" stroke="#212121" stroke-width="3" stroke-linecap="round">
      <line x1="12" y1="10" x2="28" y2="26"/>
      <line x1="28" y1="10" x2="12" y2="26"/>
    </g>
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
      event: 'COMPONENT_BURNED',
      action: 'destroy',
    },
  ],
  parameters: {
    color: {
      type: 'enum',
      label: 'Color',
      options: ['#e74c3c', '#ff9800', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ecf0f1'],
      default: '#e74c3c',
    },
  },
  observables: ['brightness', 'burned', 'color', 'on'],
  visualRules: [
    // Halo: crece con el brillo (opacidad 0 → 0.6)
    {
      observable: 'brightness',
      property: 'opacity',
      targetId: 'glow',
      mapping: { type: 'linear', min: 0, max: 0.6 },
    },
    // Domo encendido: opacidad = brillo (debajo queda el domo apagado)
    {
      observable: 'brightness',
      property: 'opacity',
      targetId: 'lamp',
      mapping: { type: 'linear', min: 0, max: 1 },
    },
    // Marcas de quemado
    {
      observable: 'burned',
      property: 'opacity',
      targetId: 'burned-mark',
      mapping: { type: 'discrete', values: { true: 1, false: 0 } },
    },
    // Color elegido en el inspector
    {
      observable: 'color',
      property: 'fill',
      targetId: 'lamp',
      mapping: { type: 'value' },
    },
  ],
};
