import type { ComponentManifest } from '@types';

/**
 * Pantalla LCD 16x2 con backpack I2C (4 pines: VCC, GND, SDA, SCL).
 *
 * El retroiluminación se modela como un LED entre VCC y GND: su brillo
 * (observable `brightness`) depende de la tensión real que entregue el
 * circuito, de modo que la pantalla se atenúa en el lienzo cuando no hay
 * alimentación. El texto de las dos líneas es un PARÁMETRO editable.
 */
export const Lcd16x2Manifest: ComponentManifest = {
  id: 'core/lcd16x2_i2c@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'LCD 16x2 I2C',
  category: 'Pantallas',

  /** Librería curada que el editor ofrece para este componente. */
  libraries: ['LiquidCrystal_I2C'],

  size: { width: 152, height: 64 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="152" height="64" viewBox="0 0 152 64">
    <rect x="2" y="2" width="148" height="60" rx="4" fill="#1b5e20" stroke="#0b3d10" stroke-width="2"/>
    <rect id="screen" x="30" y="8" width="116" height="46" rx="2" fill="#c8e6c9" stroke="#7cb342" stroke-width="1.5"/>
    <text id="line1" x="88" y="27" font-size="11" font-family="monospace" fill="#1b5e20" text-anchor="middle">Hola, mundo!</text>
    <text id="line2" x="88" y="46" font-size="11" font-family="monospace" fill="#1b5e20" text-anchor="middle"></text>
    <rect x="6" y="8" width="18" height="46" rx="2" fill="#0d47a1" stroke="#082a5e"/>
    <text x="15" y="32" font-size="7" font-family="monospace" fill="#e3f2fd" text-anchor="middle" transform="rotate(-90 15 32)">I2C</text>
    <text x="17" y="60" font-size="6" font-family="monospace" fill="#81c784">1602A</text>
  </svg>`,

  pins: [
    { id: 'vcc', label: 'VCC', position: { x: 6, y: 12 }, kind: 'power' },
    { id: 'gnd', label: 'GND', position: { x: 6, y: 26 }, kind: 'ground' },
    { id: 'sda', label: 'SDA', position: { x: 6, y: 42 }, kind: 'io' },
    { id: 'scl', label: 'SCL', position: { x: 6, y: 56 }, kind: 'io' },
  ],

  elements: [
    {
      id: 'backlight',
      primitive: 'led',
      ports: { anode: 'vcc', cathode: 'gnd' },
      params: { forwardVoltage: 3.2, seriesResistance: 220, nominalCurrent: 0.01 },
    },
  ],

  parameters: {
    line1: { type: 'string', label: 'Línea 1', maxLength: 16, default: 'Hola, mundo!' },
    line2: { type: 'string', label: 'Línea 2', maxLength: 16, default: '' },
  },

  observables: ['line1', 'line2', 'brightness'],

  visualRules: [
    { observable: 'line1', property: 'text', targetId: 'line1', mapping: { type: 'value' } },
    { observable: 'line2', property: 'text', targetId: 'line2', mapping: { type: 'value' } },
    {
      observable: 'brightness',
      property: 'opacity',
      targetId: 'screen',
      mapping: { type: 'linear', min: 0.5, max: 1 },
    },
  ],
};
