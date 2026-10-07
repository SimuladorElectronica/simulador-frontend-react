import type { CircuitNetlist, WorkerEvent } from '@types';
import { COMPONENT_REGISTRY } from '../core/registry';

export class PhysicsEngine {
  private netlist: CircuitNetlist = { components: [], wires: [] };
  private nodeVoltages: Record<string, number> = {};

  // Mantiene el mapa acumulado de pines que están entregando voltaje activo
  private activeDrivenVoltages: Record<string, number> = {};

  public updateNetlist(netlist: CircuitNetlist) {
    this.netlist = netlist;
  }

  public step(deltaMs: number, emitEvent: (event: WorkerEvent) => void) {
    // 1. Resolver los voltajes del circuito basándonos en los pines "drivers" activos
    this.solveNodalVoltages();

    const newDrivenVoltages: Record<string, number> = {};

    // 2. Evaluar cada componente con la información del circuito
    for (const comp of this.netlist.components) {
      const descriptor = COMPONENT_REGISTRY[comp.type];
      if (!descriptor || !descriptor.stepSimulation) continue;

      const compPinVoltages: Record<string, number> = {};
      for (const pin of comp.pins) {
        compPinVoltages[pin.id] = this.nodeVoltages[pin.id] ?? 0;
      }

      const result = descriptor.stepSimulation({
        componentId: comp.id,
        state: comp.state,
        pinVoltages: compPinVoltages,
        deltaMs,
      });

      comp.state = result.nextState;

      // Recopilar los voltajes que este componente impone al circuito para el próximo resolver
      if (result.drivenVoltages) {
        Object.assign(newDrivenVoltages, result.drivenVoltages);
      }

      if (result.burned) {
        emitEvent({
          type: 'COMPONENT_BURNED',
          payload: {
            componentId: comp.id,
            reason: result.burnReason || 'Destruido por sobrecarga.',
            power: result.power || 0,
          },
        });
      }
    }

    // Actualizar el registro de fuentes activas para el siguiente ciclo
    this.activeDrivenVoltages = newDrivenVoltages;
  }

  // Resolver matriz nodal sin NINGÚN string hardcodeado
  private solveNodalVoltages() {
    this.nodeVoltages = {};

    // 1. Asignar directamente las tensiones forzadas por los componentes (Fuentes, DACs, GPIOs)
    for (const [pinId, voltage] of Object.entries(this.activeDrivenVoltages)) {
      this.nodeVoltages[pinId] = voltage;
    }

    // 2. Propagar equipotenciales a través de las conexiones/cables (Wires)
    for (const wire of this.netlist.wires) {
      const vFrom = this.nodeVoltages[wire.fromPinId];
      const vTo = this.nodeVoltages[wire.toPinId];

      if (vFrom !== undefined && vTo === undefined) {
        this.nodeVoltages[wire.toPinId] = vFrom;
      } else if (vTo !== undefined && vFrom === undefined) {
        this.nodeVoltages[wire.fromPinId] = vTo;
      }
    }
  }

  public getNodeVoltages() {
    return this.nodeVoltages;
  }
}