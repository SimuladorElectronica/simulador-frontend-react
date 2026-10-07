import type { ComponentDescriptor } from '@types';
import type { Pin } from '@types';
import { Esp32View } from './Esp32View';

export interface Esp32State {
  isPowered: boolean;
  isBroadcastingWifi?: boolean;
  gpioModes?: Record<number, 'INPUT' | 'OUTPUT'>;
  gpioValues?: Record<number, number>;
}

export const Esp32Descriptor: ComponentDescriptor<Esp32State> = {
  type: 'ESP32',
  label: 'ESP32 DevKit v1',
  defaultSize: { width: 140, height: 260 },

  defaultState: {
    isPowered: true,
    isBroadcastingWifi: false,
  },

  createDefaultPins: (instanceId) => {
    const leftPinNames = [
      'EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25',
      'D26', 'D27', 'D14', 'D12', 'D13', 'GNDl', 'VIN'
    ];
    const rightPinNames = [
      'D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5',
      'TX2', 'RX2', 'D4', 'D2', 'D15', 'GNDr', '3V3'
    ];

    const pins: Pin[] = [];

    // Pines columna izquierda
    leftPinNames.forEach((name, i) => {
      pins.push({
        id: `${instanceId}-${name}`,
        name,
        relativePos: { x: 10, y: 30 + i * 15 },
      });
    });

    // Pines columna derecha
    rightPinNames.forEach((name, i) => {
      pins.push({
        id: `${instanceId}-${name}`,
        name,
        relativePos: { x: 130, y: 30 + i * 15 },
      });
    });

    return pins;
  },

  View: Esp32View,

  stepSimulation: ({ componentId, state, deltaMs }) => {
    // 1. Pines de alimentación fijos de la placa
    const drivenVoltages: Record<string, number> = {
      [`${componentId}_gnd`]: 0.0,
      [`${componentId}_gnd2`]: 0.0,
      [`${componentId}_3v3`]: 3.3,
      [`${componentId}_vin`]: 5.0,
    };

    // 2. Pines de salida programables (GPIOs)
    // Si el pin GPIO 2 está configurado como OUTPUT y su valor digital es HIGH (1), entrega 3.3V
    Object.entries(state.gpioModes || {}).forEach(([pinNumber, mode]) => {
      if (mode === 'OUTPUT') {
        const isHigh: boolean = state.gpioValues?.[Number(pinNumber)] === 1;
        const pinId = `${componentId}_gpio${pinNumber}`;
        drivenVoltages[pinId] = isHigh ? 3.3 : 0.0;
      }
    });

    return {
      nextState: state,
      drivenVoltages, // Le pasa al motor de física las tensiones activas de esta placa
    };
  }
}