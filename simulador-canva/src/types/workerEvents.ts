import type { ComponentInstance, Wire } from './basicElements';

// Estado eléctrico calculado por el motor físico
export interface PinElectricalState {
  voltage: number; // Tensión en Volts
  current: number; // Corriente en Amperes
}

export interface CircuitNetlist {
  components: ComponentInstance[];
  wires: Wire[];
}

export type UICommand =
  | { type: 'INIT'; payload: CircuitNetlist }
  | { type: 'UPDATE_NETLIST'; payload: CircuitNetlist }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | {
      type: 'LOAD_USER_CODE';
      payload: {
        targetComponentId: string; // ID único de la instancia (ej: 'esp32_1', 'esp32_2')
        code: string;              // Código
        boardType?: string;        // Tipo de placa (ej: 'ESP32', 'ARDUINO_UNO')
      };
    };

export type WorkerEvent =
  | { type: 'TICK_UPDATE'; payload: { componentStates: Record<string, any>; pinVoltages: Record<string, number> } }
  | { type: 'COMPONENT_BURNED'; payload: { componentId: string; reason: string; power: number } }
  | { type: 'BROWNOUT_RESET'; payload: { sourceId: string; voltage: number } }
  | { type: 'LOG_OUTPUT'; payload: { sourceId: string; message: string } }; // Identificamos de qué MCU proviene el log