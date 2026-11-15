import type { ComponentManifest } from '@types';

/**
 * Sensor de temperatura y humedad DHT11 (módulo de 3 pines).
 *
 * La parte eléctrica es la resistencia de pull-up de 10 kΩ entre DATA y VCC
 * (habitual en el módulo). Las variables ambientales son controles
 * deslizantes: viajan al Worker con INTERACT y vuelven en el SNAPSHOT, con
 * lo que la lectura del módulo se actualiza en el lienzo.
 */
export const Dht11Manifest: ComponentManifest = {
  id: 'core/dht11@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'Sensor DHT11',
  category: 'Sensores',

  size: { width: 76, height: 50 },

  art: `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="50" viewBox="0 0 76 50">
    <rect x="2" y="2" width="72" height="46" rx="4" fill="#0288d1" stroke="#01579b" stroke-width="2"/>
    <rect x="34" y="7" width="36" height="28" rx="3" fill="#b3e5fc" stroke="#0277bd" stroke-width="1.5"/>
    <text id="temp" x="52" y="19" font-size="10" font-family="monospace" fill="#01579b" text-anchor="middle">25°C</text>
    <text id="hum" x="52" y="31" font-size="10" font-family="monospace" fill="#01579b" text-anchor="middle">50%</text>
    <rect x="7" y="7" width="23" height="34" rx="3" fill="#eceff1" stroke="#90a4ae" stroke-width="1.5"/>
    <g stroke="#b0bec5" stroke-width="1.5">
      <line x1="11" y1="13" x2="26" y2="13"/>
      <line x1="11" y1="19" x2="26" y2="19"/>
      <line x1="11" y1="25" x2="26" y2="25"/>
      <line x1="11" y1="31" x2="26" y2="31"/>
      <line x1="11" y1="37" x2="26" y2="37"/>
    </g>
    <text x="52" y="45" font-size="7" font-family="sans-serif" fill="#e1f5fe" text-anchor="middle">DHT11</text>
  </svg>`,

  pins: [
    { id: 'vcc', label: 'VCC', position: { x: 6, y: 12 }, kind: 'power' },
    { id: 'data', label: 'DATA', position: { x: 6, y: 25 }, kind: 'io' },
    { id: 'gnd', label: 'GND', position: { x: 6, y: 38 }, kind: 'ground' },
  ],

  elements: [
    {
      id: 'pullup',
      primitive: 'resistor',
      ports: { a: 'vcc', b: 'data' },
      params: { resistance: 10000 },
    },
  ],

  interactions: [
    { name: 'temperature', gesture: 'slider', label: 'Temperatura', min: 0, max: 50, step: 1, unit: '°C', defaultValue: 25 },
    { name: 'humidity', gesture: 'slider', label: 'Humedad', min: 20, max: 90, step: 1, unit: '%', defaultValue: 50 },
  ],

  observables: ['temperature', 'humidity'],

  visualRules: [
    {
      observable: 'temperature',
      property: 'text',
      targetId: 'temp',
      mapping: { type: 'text', decimals: 0, suffix: '°C' },
    },
    {
      observable: 'humidity',
      property: 'text',
      targetId: 'hum',
      mapping: { type: 'text', decimals: 0, suffix: '%' },
    },
  ],
};
