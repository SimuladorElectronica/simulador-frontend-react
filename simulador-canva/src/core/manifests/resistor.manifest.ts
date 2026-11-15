import type { ComponentManifest } from '@types';

/**
 * Resistencia axial. UN solo manifiesto para cualquier valor: `resistance`
 * es un parámetro numérico editable en el inspector (no existe un manifiesto
 * distinto por cada valor de la serie E24).
 *
 * Las bandas de color y la etiqueta del valor se recalculan en el lienzo a
 * partir del observable `resistance` (reglas `bands` y `text`).
 */
export const ResistorManifest: ComponentManifest = {
  id: 'core/resistor@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Resistencia',
  category: 'Pasivos',

  size: { width: 90, height: 40 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="40" viewBox="0 0 90 40">
    <line x1="6" y1="20" x2="27" y2="20" stroke="#78909c" stroke-width="2"/>
    <line x1="63" y1="20" x2="84" y2="20" stroke="#78909c" stroke-width="2"/>
    <rect x="26" y="9" width="38" height="22" rx="5" fill="#e0c9a6" stroke="#a1887f" stroke-width="1.5"/>
    <g id="bands">
      <rect x="31" y="9" width="5" height="22" fill="#e74c3c"/>
      <rect x="40" y="9" width="5" height="22" fill="#e74c3c"/>
      <rect x="49" y="9" width="5" height="22" fill="#8d5a2b"/>
      <rect x="58" y="9" width="5" height="22" fill="#ffd700"/>
    </g>
    <text id="value" x="45" y="38" font-size="9" font-family="monospace" fill="#37474f" text-anchor="middle">220Ω</text>
  </svg>`,

  pins: [
    { id: 'a', label: '1', position: { x: 6, y: 20 }, kind: 'passive' },
    { id: 'b', label: '2', position: { x: 84, y: 20 }, kind: 'passive' },
  ],

  elements: [
    {
      id: 'r1',
      primitive: 'resistor',
      ports: { a: 'a', b: 'b' },
      params: { resistance: 220 },
    },
  ],

  parameters: {
    resistance: {
      type: 'number',
      label: 'Resistencia',
      min: 1,
      max: 100_000_000,
      step: 1,
      unit: 'Ω',
      default: 220,
    },
  },

  observables: ['resistance'],

  visualRules: [
    {
      observable: 'resistance',
      property: 'content',
      targetId: 'bands',
      mapping: { type: 'bands', startX: 31, startY: 9, width: 5, height: 22, pitch: 9 },
    },
    {
      observable: 'resistance',
      property: 'text',
      targetId: 'value',
      mapping: { type: 'text', format: 'ohms' },
    },
  ],
};
