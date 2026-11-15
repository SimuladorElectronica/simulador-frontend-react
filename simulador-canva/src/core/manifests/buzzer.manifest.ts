import type { ComponentManifest } from '@types';

/**
 * Zumbador (buzzer) de 2 terminales.
 *
 * El elemento `resistance` modela la impedancia de la bobina (~42 Ω): el
 * observable `on` se deriva de la tensión que aparece en sus bornes, con lo
 * que las ondas sonoras del dibujo se encienden cuando el Worker reporta
 * tensión en el componente.
 */
export const BuzzerManifest: ComponentManifest = {
  id: 'core/buzzer@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Buzzer',
  category: 'Salidas',

  size: { width: 56, height: 56 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <g id="waves" fill="none" stroke="#4fc3f7" stroke-width="2" stroke-linecap="round" opacity="0.12">
      <path d="M37 11 A22 22 0 0 1 37 49"/>
      <path d="M39.5 6.6 A27 27 0 0 1 39.5 53.4"/>
    </g>
    <circle cx="26" cy="30" r="18" fill="#263238" stroke="#111827" stroke-width="2"/>
    <circle cx="26" cy="30" r="11" fill="#37474f"/>
    <circle cx="26" cy="30" r="4" fill="#0b1116"/>
    <line x1="14" y1="47" x2="14" y2="52" stroke="#90a4ae" stroke-width="3"/>
    <line x1="38" y1="47" x2="38" y2="52" stroke="#90a4ae" stroke-width="3"/>
    <text x="26" y="16" font-size="6" font-family="monospace" fill="#90a4ae" text-anchor="middle">+</text>
  </svg>`,

  pins: [
    { id: 'vcc', label: '+', position: { x: 14, y: 52 }, kind: 'power' },
    { id: 'gnd', label: '−', position: { x: 38, y: 52 }, kind: 'ground' },
  ],

  elements: [
    {
      id: 'coil',
      primitive: 'resistor',
      ports: { a: 'vcc', b: 'gnd' },
      params: { resistance: 42 },
    },
  ],

  observables: ['on', 'voltage'],

  visualRules: [
    {
      observable: 'on',
      property: 'opacity',
      targetId: 'waves',
      mapping: { type: 'discrete', values: { true: 1, false: 0.12 } },
    },
  ],
};
