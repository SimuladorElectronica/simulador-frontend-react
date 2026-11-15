import type { ComponentManifest } from '@types';

/**
 * Relé electromecánico de un canal (bobina + contactos COM/NO/NC).
 *
 * El acoplamiento electromecánico es un `behavior` declarativo: tras cada
 * resolución el Worker compara la tensión de la bobina con `threshold` y
 * conmuta los elementos `switch` correspondientes. El LED indicador y la
 * llave del dibujo siguen al observable `energized`.
 */
export const RelayManifest: ComponentManifest = {
  id: 'core/relay@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Relé 5 V',
  category: 'Salidas',

  size: { width: 96, height: 64 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">
    <rect x="8" y="6" width="56" height="52" rx="4" fill="#0d47a1" stroke="#082a5e" stroke-width="2"/>
    <rect x="14" y="12" width="44" height="14" rx="2" fill="#1565c0"/>
    <text x="36" y="22" font-size="8" font-family="sans-serif" fill="#e3f2fd" text-anchor="middle">COIL 5V</text>
    <circle id="led" cx="36" cy="42" r="5" fill="#607d8b"/>
    <text x="36" y="56" font-size="7" font-family="sans-serif" fill="#90a4ae" text-anchor="middle">RELAY</text>
    <circle cx="70" cy="40" r="3" fill="#eceff1" stroke="#90a4ae"/>
    <circle cx="86" cy="32" r="3" fill="#eceff1" stroke="#90a4ae"/>
    <circle cx="86" cy="48" r="3" fill="#eceff1" stroke="#90a4ae"/>
    <line id="arm" x1="70" y1="40" x2="88" y2="40" stroke="#ff9800" stroke-width="3" stroke-linecap="round" transform="rotate(27 70 40)"/>
    <text x="76" y="24" font-size="6" font-family="monospace" fill="#90a4ae" text-anchor="middle">NO</text>
    <text x="76" y="60" font-size="6" font-family="monospace" fill="#90a4ae" text-anchor="middle">NC</text>
  </svg>`,

  pins: [
    { id: 'coil+', label: 'COIL+', position: { x: 6, y: 20 }, kind: 'power' },
    { id: 'coil-', label: 'COIL−', position: { x: 6, y: 46 }, kind: 'ground' },
    { id: 'com', label: 'COM', position: { x: 90, y: 40 }, kind: 'passive' },
    { id: 'no', label: 'NO', position: { x: 90, y: 32 }, kind: 'passive' },
    { id: 'nc', label: 'NC', position: { x: 90, y: 48 }, kind: 'passive' },
  ],

  elements: [
    {
      id: 'coil',
      primitive: 'resistor',
      ports: { a: 'coil+', b: 'coil-' },
      params: { resistance: 400 },
    },
    {
      id: 'sw_no',
      primitive: 'switch',
      ports: { a: 'com', b: 'no' },
      params: { closed: 0, onResistance: 0.1 },
    },
    {
      id: 'sw_nc',
      primitive: 'switch',
      ports: { a: 'com', b: 'nc' },
      params: { closed: 1, onResistance: 0.1 },
    },
  ],

  behaviors: [
    { type: 'voltageSwitch', coilElement: 'coil', switchElement: 'sw_no', threshold: 2.5 },
    { type: 'voltageSwitch', coilElement: 'coil', switchElement: 'sw_nc', threshold: 2.5, inverted: true },
  ],

  observables: ['energized'],

  visualRules: [
    {
      observable: 'energized',
      property: 'fill',
      targetId: 'led',
      mapping: { type: 'discrete', values: { true: '#ff9800', false: '#607d8b' } },
    },
    {
      observable: 'energized',
      property: 'transform',
      targetId: 'arm',
      mapping: { type: 'discrete', values: { true: 'rotate(-27 70 40)', false: 'rotate(27 70 40)' } },
    },
  ],
};
