import type { ComponentManifest } from '@types';

/**
 * LDR (fotocelda) de 2 terminales.
 *
 * Usa la primitiva `ldr` del solver: su resistencia varía con la
 * iluminación (`light`, 0-100 %) según `resistanceDark`/`resistanceLight`.
 * El slider de luz envía `INTERACT { field: 'light' }` y el Worker lo estampa
 * en el netlist, con lo que cambian tanto la lectura como el circuito.
 */
export const LdrManifest: ComponentManifest = {
  id: 'core/ldr@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'LDR (fotocelda)',
  category: 'Pasivos',

  size: { width: 56, height: 52 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="52" viewBox="0 0 56 52">
    <line x1="6" y1="44" x2="15" y2="35" stroke="#78909c" stroke-width="2"/>
    <line x1="50" y1="44" x2="41" y2="35" stroke="#78909c" stroke-width="2"/>
    <circle cx="24" cy="24" r="17" fill="#fdd835" stroke="#f9a825" stroke-width="2"/>
    <path d="M14 28 L18 18 L22 28 L26 18 L30 28 L34 20" fill="none" stroke="#5d4037" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <g id="rays" stroke="#ff8f00" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M44 6 L51 2"/>
      <path d="M46 13 L53 11"/>
      <path d="M42 20 L49 21"/>
    </g>
    <text id="value" x="28" y="50" font-size="9" font-family="monospace" fill="#37474f" text-anchor="middle">4.9kΩ</text>
  </svg>`,

  pins: [
    { id: 'a', label: '1', position: { x: 6, y: 44 }, kind: 'passive' },
    { id: 'b', label: '2', position: { x: 50, y: 44 }, kind: 'passive' },
  ],

  elements: [
    {
      id: 'ldr1',
      primitive: 'ldr',
      ports: { a: 'a', b: 'b' },
      params: { resistanceDark: 1000000, resistanceLight: 300, light: 60 },
    },
  ],

  interactions: [
    { name: 'light', gesture: 'slider', label: 'Iluminación', min: 0, max: 100, step: 1, unit: '%', defaultValue: 60 },
  ],

  observables: ['light', 'resistance'],

  visualRules: [
    {
      observable: 'light',
      property: 'opacity',
      targetId: 'rays',
      mapping: { type: 'linear', min: 0.15, max: 1, sourceMin: 0, sourceMax: 100 },
    },
    {
      observable: 'resistance',
      property: 'text',
      targetId: 'value',
      mapping: { type: 'text', format: 'ohms' },
    },
  ],
};
