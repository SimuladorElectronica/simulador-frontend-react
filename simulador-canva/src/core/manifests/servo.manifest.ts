import type { ComponentManifest } from '@types';

/**
 * Servomotor SG90 (micro servo de plástico).
 *
 * El ángulo es un control deslizante (0-180°) que viaja al Worker con
 * INTERACT; el brazo del dibujo gira con la regla `rotate` y la lectura
 * muestra los grados. El elemento `resistance` entre VCC y GND modela el
 * consumo en reposo del servo.
 */
export const ServoSg90Manifest: ComponentManifest = {
  id: 'core/servo_sg90@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Servomotor SG90',
  category: 'Salidas',

  size: { width: 84, height: 64 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="64" viewBox="0 0 84 64">
    <rect x="2" y="24" width="14" height="6" rx="1" fill="#78909c"/>
    <rect x="2" y="36" width="14" height="6" rx="1" fill="#78909c"/>
    <rect x="2" y="48" width="14" height="6" rx="1" fill="#78909c"/>
    <rect x="16" y="6" width="22" height="10" rx="2" fill="#0277bd"/>
    <rect x="14" y="12" width="56" height="44" rx="4" fill="#0288d1" stroke="#01579b" stroke-width="2"/>
    <g id="arm" transform="rotate(0 42 26)">
      <rect x="40" y="4" width="5" height="24" rx="2.5" fill="#fdd835" stroke="#f9a825" stroke-width="1"/>
      <circle cx="42.5" cy="7" r="3" fill="#f9a825"/>
    </g>
    <circle cx="42" cy="26" r="9" fill="#eceff1" stroke="#90a4ae" stroke-width="2"/>
    <circle cx="42" cy="26" r="3" fill="#78909c"/>
    <text id="angle" x="44" y="49" font-size="10" font-family="monospace" fill="#e3f2fd" text-anchor="middle">90°</text>
  </svg>`,

  pins: [
    { id: 'vcc', label: 'VCC', position: { x: 6, y: 14 }, kind: 'power' },
    { id: 'gnd', label: 'GND', position: { x: 6, y: 32 }, kind: 'ground' },
    { id: 'signal', label: 'PWM', position: { x: 6, y: 50 }, kind: 'io' },
  ],

  elements: [
    {
      id: 'coil',
      primitive: 'resistor',
      ports: { a: 'vcc', b: 'gnd' },
      params: { resistance: 1500 },
    },
  ],

  interactions: [
    { name: 'angle', gesture: 'slider', label: 'Ángulo', min: 0, max: 180, step: 1, unit: '°', defaultValue: 90 },
  ],

  observables: ['angle', 'voltage'],

  visualRules: [
    {
      observable: 'angle',
      property: 'transform',
      targetId: 'arm',
      mapping: { type: 'rotate', centerX: 42, centerY: 26, from: -90, to: 90, sourceMin: 0, sourceMax: 180 },
    },
    {
      observable: 'angle',
      property: 'text',
      targetId: 'angle',
      mapping: { type: 'text', decimals: 0, suffix: '°' },
    },
  ],
};
