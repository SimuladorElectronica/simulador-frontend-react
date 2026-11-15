import type { ComponentManifest } from '@types';

/**
 * Módulo OLED SSD1306 128x64 (4 pines I2C).
 *
 * Incluye las pull-ups de 4,7 kΩ del bus y una carga equivalente entre VCC
 * y GND: de ahí sale el observable `on`, con el que el lienzo atenúa la
 * pantalla cuando el módulo no está alimentado. El texto es configurable.
 */
export const OledSsd1306Manifest: ComponentManifest = {
  id: 'core/oled_ssd1306@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'OLED SSD1306 128x64',
  category: 'Pantallas',

  size: { width: 140, height: 64 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="64" viewBox="0 0 140 64">
    <rect x="2" y="2" width="136" height="60" rx="3" fill="#102027" stroke="#000a12" stroke-width="2"/>
    <rect id="screen" x="26" y="7" width="108" height="50" rx="2" fill="#000000" stroke="#37474f" stroke-width="1.5"/>
    <text id="line1" x="80" y="28" font-size="11" font-family="monospace" fill="#00e5ff" text-anchor="middle">SSD1306</text>
    <text id="line2" x="80" y="46" font-size="11" font-family="monospace" fill="#00e5ff" text-anchor="middle">128x64</text>
    <text x="14" y="12" font-size="6" font-family="monospace" fill="#546e7a" text-anchor="middle">OLED</text>
  </svg>`,

  pins: [
    { id: 'vcc', label: 'VCC', position: { x: 6, y: 18 }, kind: 'power' },
    { id: 'gnd', label: 'GND', position: { x: 6, y: 30 }, kind: 'ground' },
    { id: 'sda', label: 'SDA', position: { x: 6, y: 42 }, kind: 'io' },
    { id: 'scl', label: 'SCL', position: { x: 6, y: 54 }, kind: 'io' },
  ],

  elements: [
    {
      id: 'load',
      primitive: 'resistor',
      ports: { a: 'vcc', b: 'gnd' },
      params: { resistance: 330 },
    },
    {
      id: 'pu_sda',
      primitive: 'resistor',
      ports: { a: 'sda', b: 'vcc' },
      params: { resistance: 4700 },
    },
    {
      id: 'pu_scl',
      primitive: 'resistor',
      ports: { a: 'scl', b: 'vcc' },
      params: { resistance: 4700 },
    },
  ],

  parameters: {
    line1: { type: 'string', label: 'Línea 1', maxLength: 16, default: 'SSD1306' },
    line2: { type: 'string', label: 'Línea 2', maxLength: 16, default: '128x64' },
  },

  observables: ['line1', 'line2', 'on'],

  visualRules: [
    { observable: 'line1', property: 'text', targetId: 'line1', mapping: { type: 'value' } },
    { observable: 'line2', property: 'text', targetId: 'line2', mapping: { type: 'value' } },
    {
      observable: 'on',
      property: 'opacity',
      targetId: 'screen',
      mapping: { type: 'discrete', values: { true: 1, false: 0.35 } },
    },
  ],
};
