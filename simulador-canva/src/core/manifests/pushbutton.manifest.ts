import type { ComponentManifest } from '@types';

/**
 * Pulsador táctil de paso (normalmente abierto).
 *
 * La interacción `press` envía `INTERACT { field: 'closed' }` al Worker
 * (desde el lienzo o desde el inspector); el Worker lo vuelca al parámetro
 * `closed` del elemento `switch` y el estado resultante reaparece en el
 * SNAPSHOT, con lo que el botón cambia de color en el canvas.
 */
export const PushbuttonManifest: ComponentManifest = {
  id: 'core/pushbutton@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Pulsador',
  category: 'Entradas',

  size: { width: 60, height: 60 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <rect x="4" y="8" width="52" height="42" rx="5" fill="#37474f" stroke="#263238" stroke-width="2"/>
    <rect id="cap" x="15" y="16" width="30" height="26" rx="5" fill="#b0bec5" stroke="#78909c" stroke-width="2"/>
    <circle cx="30" cy="29" r="7" fill="#90a4ae" stroke="#607d8b" stroke-width="1.5"/>
    <line x1="8" y1="50" x2="8" y2="56" stroke="#90a4ae" stroke-width="3"/>
    <line x1="52" y1="50" x2="52" y2="56" stroke="#90a4ae" stroke-width="3"/>
    <text x="30" y="58" font-size="7" font-family="sans-serif" fill="#90a4ae" text-anchor="middle">SW</text>
  </svg>`,

  pins: [
    { id: 'a', label: '1', position: { x: 8, y: 56 }, kind: 'passive' },
    { id: 'b', label: '2', position: { x: 52, y: 56 }, kind: 'passive' },
  ],

  elements: [
    {
      id: 'sw1',
      primitive: 'switch',
      ports: { a: 'a', b: 'b' },
      params: { closed: 0, onResistance: 0.1 },
    },
  ],

  interactions: [
    { name: 'closed', gesture: 'press', label: 'Pulsado', defaultValue: false },
  ],

  observables: ['closed'],

  visualRules: [
    {
      observable: 'closed',
      property: 'fill',
      targetId: 'cap',
      mapping: { type: 'discrete', values: { true: '#1565c0', false: '#b0bec5' } },
    },
  ],
};
