import type { ElectricalPrimitiveType } from './manifest';
import type { PinReference } from './domain';

export interface Netlist {
  nets: Array<{ id: string; pins: PinReference[] }>;
  elements: Array<{
    id: string;
    primitive: ElectricalPrimitiveType;
    params: Record<string, number>;
    terminals: Record<string, string>; // rol -> netId
    /** Componente que declara el elemento (lo usa el solver para los GPIO por MCU) */
    componentId?: string;
  }>;
}

export interface SolverSolution {
  nodeVoltages: Record<string, number>; // netId -> Volts
  elementResults: Record<
    string,
    {
      voltage: number;
      current: number;
      power: number;
      conducting?: boolean;
      /** true cuando un monitor con action:'destroy' abrió el componente */
      destroyed?: boolean;
    }
  >;
  diagnostics: Array<'shortCircuit' | 'floatingIsland' | 'singular' | 'noConvergence'>;
  converged: boolean;
  iterations: number;
}