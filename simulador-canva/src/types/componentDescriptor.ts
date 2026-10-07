import type { WorkerEvent } from './workerEvents';

export interface SimulationContext<TState = any> {
  componentId: string;
  state: TState;
  pinVoltages: Record<string, number>; // Voltaje calculado en cada pin del componente
  deltaMs: number;                     // Tiempo transcurrido en el paso (ej: 10ms)
}

export interface SimulationStepResult<TState = any> {
  nextState: TState;             // Nuevo estado interno (ej: { brightness: 0.8, isBurned: false })
  drivenVoltages?: Record<string, number>; // Pines que este componente está forzando/alimentando en este tick
  burned?: boolean;              // Indica si el componente se destruyó en este paso
  burnReason?: string;           // Motivo de la falla
  power?: number;                // Potencia disipada calculada
  events?: WorkerEvent[];        // Eventos adicionales (ej: BROWNOUT_RESET, LOGS)
}

export interface ComponentDescriptor<TState = any> {
  type: string;
  label: string;
  defaultSize: { width: number; height: number };
  defaultState: TState;
  createDefaultPins: (instanceId: string) => any[];
  View: React.FC<any>;
  
  // FUNCIÓN DE LÓGICA FÍSICA INDIVIDUAL
  stepSimulation: (ctx: SimulationContext<TState>) => SimulationStepResult<TState>;
}