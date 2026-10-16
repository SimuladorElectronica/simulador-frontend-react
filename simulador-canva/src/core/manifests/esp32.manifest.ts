import type { ComponentManifest } from '@types';

export const Esp32Manifest: ComponentManifest = {
  id: 'core/esp32@1',
  schemaVersion: 1,
  version: '1.0.0',
  displayName: 'ESP32 DevKit v1',
  category: 'Microcontroladores',

  // Enlace obligatorio para habilitar el Contrato 3 (Runtime C++ / MCU)
  mcu: {
    platform: 'esp32@1',
  },

  size: { width: 140, height: 260 },

  // Arte SVG sanitizado de la placa
  art: `<svg viewBox="0 0 140 260">
    <rect width="140" height="260" fill="#1a252f" rx="8" stroke="#2c3e50" stroke-width="2"/>
    <rect x="25" y="15" width="80" height="80" fill="#bdc3c7" rx="4" stroke="#7f8c8d" stroke-width="1"/>
    <text x="30" y="45" font-size="10" fill="#2c3e50" font-weight="bold">ESP-WROOM-32</text>
    <rect x="45" y="245" width="50" height="15" fill="#7f8c8d" rx="2"/>
    <circle id="pwr-led" cx="30" cy="110" r="4" fill="#7f8c8d"/>
    <text x="38" y="106" font-size="8" fill="#ecf0f1">PWR</text>
    <text x="25" y="130" font-size="12" fill="#ecf0f1" font-weight="bold">ESP32 DevKit v1</text>
  </svg>`,

  // 30 Pines del DevKit v1 con IDs semánticos y capacidades
  pins: [
    // --- COLUMNA IZQUIERDA ---
    { id: '3v3', label: '3V3', position: { x: 10, y: 30 }, kind: 'power' },
    { id: 'gnd1', label: 'GND', position: { x: 10, y: 45 }, kind: 'ground' },
    { id: 'gpio15', label: 'D15', position: { x: 10, y: 60 }, kind: 'gpio', gpio: { number: 15, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio2', label: 'D2', position: { x: 10, y: 75 }, kind: 'gpio', gpio: { number: 2, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio4', label: 'D4', position: { x: 10, y: 90 }, kind: 'gpio', gpio: { number: 4, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio16', label: 'RX2', position: { x: 10, y: 105 }, kind: 'gpio', gpio: { number: 16, capabilities: ['digitalIn', 'digitalOut'] } },
    { id: 'gpio17', label: 'TX2', position: { x: 10, y: 120 }, kind: 'gpio', gpio: { number: 17, capabilities: ['digitalIn', 'digitalOut'] } },
    { id: 'gpio5', label: 'D5', position: { x: 10, y: 135 }, kind: 'gpio', gpio: { number: 5, capabilities: ['digitalIn', 'digitalOut', 'pwm'] } },
    { id: 'gpio18', label: 'D18', position: { x: 10, y: 150 }, kind: 'gpio', gpio: { number: 18, capabilities: ['digitalIn', 'digitalOut', 'pwm'] } },
    { id: 'gpio19', label: 'D19', position: { x: 10, y: 165 }, kind: 'gpio', gpio: { number: 19, capabilities: ['digitalIn', 'digitalOut', 'pwm'] } },
    { id: 'gpio21', label: 'D21', position: { x: 10, y: 180 }, kind: 'gpio', gpio: { number: 21, capabilities: ['digitalIn', 'digitalOut'] } },
    { id: 'gpio3', label: 'RX0', position: { x: 10, y: 195 }, kind: 'gpio', gpio: { number: 3, capabilities: ['digitalIn', 'digitalOut'] } },
    { id: 'gpio1', label: 'TX0', position: { x: 10, y: 210 }, kind: 'gpio', gpio: { number: 1, capabilities: ['digitalIn', 'digitalOut'] } },
    { id: 'gpio22', label: 'D22', position: { x: 10, y: 225 }, kind: 'gpio', gpio: { number: 22, capabilities: ['digitalIn', 'digitalOut', 'pwm'] } },
    { id: 'gpio23', label: 'D23', position: { x: 10, y: 240 }, kind: 'gpio', gpio: { number: 23, capabilities: ['digitalIn', 'digitalOut', 'pwm'] } },

    // --- COLUMNA DERECHA ---
    { id: 'vin', label: 'VIN', position: { x: 130, y: 30 }, kind: 'power' },
    { id: 'gnd2', label: 'GND', position: { x: 130, y: 45 }, kind: 'ground' },
    { id: 'gpio13', label: 'D13', position: { x: 130, y: 60 }, kind: 'gpio', gpio: { number: 13, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio12', label: 'D12', position: { x: 130, y: 75 }, kind: 'gpio', gpio: { number: 12, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio14', label: 'D14', position: { x: 130, y: 90 }, kind: 'gpio', gpio: { number: 14, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio27', label: 'D27', position: { x: 130, y: 105 }, kind: 'gpio', gpio: { number: 27, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio26', label: 'D26', position: { x: 130, y: 120 }, kind: 'gpio', gpio: { number: 26, capabilities: ['digitalIn', 'digitalOut', 'adc', 'dac', 'pwm'] } },
    { id: 'gpio25', label: 'D25', position: { x: 130, y: 135 }, kind: 'gpio', gpio: { number: 25, capabilities: ['digitalIn', 'digitalOut', 'adc', 'dac', 'pwm'] } },
    { id: 'gpio33', label: 'D33', position: { x: 130, y: 150 }, kind: 'gpio', gpio: { number: 33, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio32', label: 'D32', position: { x: 130, y: 165 }, kind: 'gpio', gpio: { number: 32, capabilities: ['digitalIn', 'digitalOut', 'adc', 'touch', 'pwm'] } },
    { id: 'gpio35', label: 'D35', position: { x: 130, y: 180 }, kind: 'gpio', gpio: { number: 35, capabilities: ['digitalIn', 'adc'], inputOnly: true } },
    { id: 'gpio34', label: 'D34', position: { x: 130, y: 195 }, kind: 'gpio', gpio: { number: 34, capabilities: ['digitalIn', 'adc'], inputOnly: true } },
    { id: 'gpio39', label: 'VN', position: { x: 130, y: 210 }, kind: 'gpio', gpio: { number: 39, capabilities: ['digitalIn', 'adc'], inputOnly: true } },
    { id: 'gpio36', label: 'VP', position: { x: 130, y: 225 }, kind: 'gpio', gpio: { number: 36, capabilities: ['digitalIn', 'adc'], inputOnly: true } },
    { id: 'en', label: 'EN', position: { x: 130, y: 240 }, kind: 'power' },
  ],

  // Unión equipotencial de los pines de tierra
  internalGroups: [
    ['gnd1', 'gnd2'],
  ],

  // Modelos eléctricos que alimentan el solver nodal (Contrato 5)
  elements: [
    // Fuente regulada interna de 3.3V
    {
      id: 'vcc_3v3',
      primitive: 'voltageSource',
      ports: { positive: '3v3', negative: 'gnd1' },
      params: { voltage: 3.3, outputResistance: 0.1 },
    },
    // Vin (Alimentación USB / Externa 5V)
    {
      id: 'vcc_5v',
      primitive: 'voltageSource',
      ports: { positive: 'vin', negative: 'gnd1' },
      params: { voltage: 5.0, outputResistance: 0.1 },
    },
    // Referencia 0V
    {
      id: 'gnd_ref',
      primitive: 'groundRef',
      ports: { pin: 'gnd1' },
      params: {},
    },
    // Definición de las primitivas GPIO para los pines digitales principales
    ...[1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33].map((num) => ({
      id: `gpio_${num}`,
      primitive: 'gpio' as const,
      ports: { pad: `gpio${num}`, supply: '3v3', ground: 'gnd1' },
      params: {
        gpioNumber: num,
        outputResistance: 40,      // Resistencia típica de salida del driver GPIO de ESP32 (~40 Ohms)
        inputLow: 0.8,             // Umbral VIL (< 0.8V es LOW)
        inputHigh: 2.0,            // Umbral VIH (> 2.0V es HIGH)
        pullUpResistance: 45000,   // Resistencia Pull-Up interna 45k
        pullDownResistance: 45000, // Resistencia Pull-Down interna 45k
      },
    })),
  ],

  // Monitor de daño / protección por caída de tensión (Brownout Reset)
  monitors: [
    {
      element: 'vcc_3v3',
      quantity: 'voltage',
      comparison: 'below',
      limit: 2.8,           // Caída por debajo de 2.8V activa el evento
      duration: 10000,      // 10 ms (10,000 us virtuales)
      event: 'BROWNOUT_RESET',
      action: 'reset',
      scope: 'component',
    },
  ],

  // Observables para la UI
  observables: ['isPowered', 'isBroadcastingWifi'],

  // Reglas de mapeo visual hacia el SVG
  visualRules: [
    {
      observable: 'isPowered',
      property: 'fill',
      mapping: { type: 'discrete', values: { true: '#2ecc71', false: '#7f8c8d' }, targetId: 'pwr-led' },
    },
  ],
};