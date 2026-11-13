import type { ComponentManifest } from '@types';

/**
 * Sensor ultrasónico de distancia HC-SR04.
 *
 * Sin elementos eléctricos en el MVP (el modelado del eco es tarea del motor
 * electromecánico): la distancia es un control deslizante que el Worker
 * devuelve en el SNAPSHOT y el lienzo pinta en la lectura del módulo.
 */
export const Hcsr04Manifest: ComponentManifest = {
  id: 'core/hcsr04@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Sensor ultrasónico HC-SR04',
  category: 'Sensores',

  size: { width: 80, height: 52 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="52" viewBox="0 0 80 52">
    <rect x="2" y="2" width="76" height="40" rx="3" fill="#1565c0" stroke="#0d47a1" stroke-width="2"/>
    <circle cx="22" cy="16" r="12" fill="#b0bec5" stroke="#78909c" stroke-width="2"/>
    <circle cx="58" cy="16" r="12" fill="#b0bec5" stroke="#78909c" stroke-width="2"/>
    <circle cx="22" cy="16" r="6" fill="#78909c"/>
    <circle cx="58" cy="16" r="6" fill="#78909c"/>
    <text id="dist" x="40" y="38" font-size="9" font-family="monospace" fill="#e3f2fd" text-anchor="middle">100 cm</text>
    <line x1="14" y1="42" x2="14" y2="48" stroke="#90a4ae" stroke-width="3"/>
    <line x1="32" y1="42" x2="32" y2="48" stroke="#90a4ae" stroke-width="3"/>
    <line x1="48" y1="42" x2="48" y2="48" stroke="#90a4ae" stroke-width="3"/>
    <line x1="66" y1="42" x2="66" y2="48" stroke="#90a4ae" stroke-width="3"/>
  </svg>`,

  pins: [
    { id: 'vcc', label: 'VCC', position: { x: 14, y: 48 }, kind: 'power' },
    { id: 'trig', label: 'TRIG', position: { x: 32, y: 48 }, kind: 'io' },
    { id: 'echo', label: 'ECHO', position: { x: 48, y: 48 }, kind: 'io' },
    { id: 'gnd', label: 'GND', position: { x: 66, y: 48 }, kind: 'ground' },
  ],

  elements: [],

  interactions: [
    { name: 'distance', gesture: 'slider', label: 'Distancia', min: 2, max: 400, step: 1, unit: 'cm', defaultValue: 100 },
  ],

  observables: ['distance'],

  visualRules: [
    {
      observable: 'distance',
      property: 'text',
      targetId: 'dist',
      mapping: { type: 'text', decimals: 0, suffix: ' cm' },
    },
  ],
};
