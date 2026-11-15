import type { ComponentManifest, Netlist, SolverSolution } from '@types';
import { ldrResistance } from '../solver/electricalSolver';

/* ======================================================================== */
/*  Derivación de observables por componente                                */
/*                                                                          */
/*  El Worker publica en cada SNAPSHOT un estado por COMPONENTE (además del */
/*  estado por elemento que ya existía). Esos observables son los que el     */
/*  canvas consume a través de las `visualRules` de cada manifiesto:        */
/*  brillo del LED, tensión de la fuente, ángulo del servo, lecturas de los */
/*  sensores, etc.                                                          */
/*                                                                          */
/*  El estado de un componente es:                                          */
/*      derivado de sus elementos eléctricos  ∪  entradas de interacción     */
/*  (sliders/pulsador). Los PARÁMETROS del documento ya los tiene el cliente*/
/*  y no se reenvían.                                                       */
/* ======================================================================== */

export interface ComponentStateInput {
    components: Array<{ id: string; type: string; params: Record<string, unknown> }>;
    manifests: ComponentManifest[];
    netlist: Netlist | null;
    solution: SolverSolution | null;
    /** Entradas enviadas por la UI con INTERACT (componentId → campo → valor) */
    inputs: Map<string, Record<string, unknown>>;
}

export type ComponentState = Record<string, unknown>;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Redondeo estable: evita que ruido de coma flotante dispare snapshots. */
function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/**
 * Observables derivados de un elemento eléctrico según su primitiva.
 * `params` es la ficha YA fusionada con los parámetros de la instancia
 * (la arma `buildNetlist`), por lo que refleja el estado real del netlist.
 */
function applyElementObservables(
    state: ComponentState,
    primitive: string,
    params: Record<string, number>,
    result: SolverSolution['elementResults'][string] | undefined,
): void {
    const voltage = round(result?.voltage ?? 0, 4);

    switch (primitive) {
        case 'led': {
            const forwardVoltage = params.forwardVoltage ?? 1.8;
            const nominalCurrent = params.nominalCurrent ?? 0.02;
            const destroyed = result?.destroyed === true;
            const conducting = !destroyed && (result?.voltage ?? 0) > forwardVoltage;
            const current = Math.abs(result?.current ?? 0);
            // 0 apagado; encendido escala con la corriente (suelo 0.2 para que
            // un LED apenas polarizado ya se note, techo 1 para sobrecorriente)
            state.brightness = destroyed ? 0 : conducting ? round(clamp(current / nominalCurrent, 0.2, 1), 2) : 0;
            state.on = conducting;
            state.burned = destroyed;
            state.voltage = voltage;
            break;
        }

        case 'voltageSource': {
            state.voltage = voltage;
            state.isPowered = Math.abs(result?.voltage ?? 0) > 0.1;
            break;
        }

        case 'switch': {
            const closed = (params.closed ?? 0) === 1;
            state.closed = closed;
            state.on = closed;
            state.voltage = voltage;
            break;
        }

        case 'resistor': {
            state.resistance = params.resistance ?? 1000;
            state.voltage = voltage;
            // "encendido" genérico: tensión presente en los bornes (buzzer, bobinas)
            state.on = Math.abs(result?.voltage ?? 0) >= 0.5;
            break;
        }

        case 'ldr': {
            state.light = params.light ?? 50;
            state.resistance = Math.round(ldrResistance(params));
            state.voltage = voltage;
            state.on = Math.abs(result?.voltage ?? 0) >= 0.5;
            break;
        }

        case 'potentiometer': {
            state.position = round(clamp(params.position ?? 0.5, 0, 1), 3);
            state.resistance = params.resistance ?? 10000;
            break;
        }

        case 'gpio':
        case 'groundRef':
        default:
            break;
    }
}

/**
 * Estado visible de cada componente del circuito cargado.
 *
 * Clave = id del componente (sin `:`), para distinguirlo en el SNAPSHOT de
 * las claves de elemento, que son `componentId:elementId`.
 */
export function deriveComponentStates(input: ComponentStateInput): Record<string, ComponentState> {
    const manifestById = new Map(input.manifests.map((m) => [m.id, m]));

    const paramsByElement = new Map<string, Record<string, number>>();
    for (const element of input.netlist?.elements ?? []) {
        paramsByElement.set(element.id, element.params);
    }

    const states: Record<string, ComponentState> = {};

    for (const component of input.components) {
        const manifest = manifestById.get(component.type);
        if (!manifest) continue;

        const state: ComponentState = {};

        for (const element of manifest.elements) {
            const elementId = `${component.id}:${element.id}`;
            applyElementObservables(
                state,
                element.primitive,
                paramsByElement.get(elementId) ?? element.params,
                input.solution?.elementResults[elementId],
            );
        }

        // Acoplamiento electromecánico declarativo (p. ej. el relé: la bobina
        // manda en los contactos). Se expone como `energized`.
        const behavior =
            manifest.behaviors?.find((b) => !b.inverted) ?? manifest.behaviors?.[0];
        if (behavior?.type === 'voltageSwitch') {
            const coilId = `${component.id}:${behavior.coilElement}`;
            const coilVoltage = Math.abs(input.solution?.elementResults[coilId]?.voltage ?? 0);
            const active = coilVoltage >= behavior.threshold;
            state.energized = behavior.inverted ? !active : active;
        }

        // Entradas de la UI (sliders, pulsador): mandan sobre lo derivado.
        Object.assign(state, input.inputs.get(component.id));

        states[component.id] = state;
    }

    return states;
}
