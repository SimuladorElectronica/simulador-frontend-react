import type { ComponentManifest } from '@types';

/**
 * Potenciómetro rotary de 3 terminales (extremos `a`/`b` y deslizador `wiper`).
 *
 * El slider `position` (0..1) viaja al Worker por INTERACT y se estampa como
 * divisor resistivo en el solver: `R(a,wiper) = R·position`,
 * `R(wiper,b) = R·(1−position)`. El puntero del dibujo gira con el mismo
 * observable (regla `rotate`).
 */
export const PotentiometerManifest: ComponentManifest = {
  id: 'core/potentiometer@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Potenciómetro 10 kΩ',
  category: 'Entradas',

  size: { width: 70, height: 70 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70">
    <rect x="4" y="12" width="12" height="8" rx="2" fill="#78909c"/>
    <rect x="54" y="12" width="12" height="8" rx="2" fill="#78909c"/>
    <rect x="29" y="56" width="12" height="8" rx="2" fill="#78909c"/>
    <circle cx="35" cy="34" r="26" fill="#455a64" stroke="#263238" stroke-width="2"/>
    <circle cx="35" cy="34" r="16" fill="#b0bec5" stroke="#78909c" stroke-width="2"/>
    <line id="pointer" x1="35" y1="34" x2="35" y2="14" stroke="#263238" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  pins: [
    { id: 'a', label: 'A', position: { x: 10, y: 16 }, kind: 'passive' },
    { id: 'wiper', label: 'W', position: { x: 35, y: 60 }, kind: 'analog' },
    { id: 'b', label: 'B', position: { x: 60, y: 16 }, kind: 'passive' },
  ],

  elements: [
    {
      id: 'track',
      primitive: 'potentiometer',
      ports: { a: 'a', wiper: 'wiper', b: 'b' },
      params: { resistance: 10000, position: 0.5 },
    },
  ],

  parameters: {
    resistance: { type: 'number', label: 'Resistencia total', min: 100, max: 1_000_000, step: 100, unit: 'Ω', default: 10000 },
  },

  interactions: [
    { name: 'position', gesture: 'slider', label: 'Posición del wiper', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
  ],

  observables: ['position', 'resistance'],

  visualRules: [
    {
      observable: 'position',
      property: 'transform',
      targetId: 'pointer',
      mapping: { type: 'rotate', centerX: 35, centerY: 34, from: -135, to: 135, sourceMin: 0, sourceMax: 1 },
    },
  ],
};
