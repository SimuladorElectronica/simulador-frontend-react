import type { ComponentManifest, ElectricalPrimitiveType, Netlist, SolverSolution } from '@types';

/* ======================================================================== */
/*  Interacciones y comportamientos electromecánicos                        */
/*                                                                          */
/*  - `setComponentInput`: vuelca una INTERACT de la UI a los parámetros    */
/*    eléctricos de los elementos del componente (posición del              */
/*    potenciómetro, iluminación de la LDR, `closed` del pulsador…).        */
/*  - `applyBehaviors`: aplica los comportamientos declarados en el         */
/*    manifiesto tras resolver (relé: la bobina conmuta los contactos).     */
/* ======================================================================== */

/** Parámetros que una entrada de UI puede modificar, por primitiva. */
const ELECTRICAL_INPUTS: Partial<Record<ElectricalPrimitiveType, readonly string[]>> = {
    resistor: ['resistance'],
    led: ['forwardVoltage', 'seriesResistance', 'nominalCurrent'],
    switch: ['closed'],
    potentiometer: ['position', 'resistance'],
    ldr: ['light', 'resistanceDark', 'resistanceLight'],
    voltageSource: ['voltage'],
};

/**
 * Escribe una entrada de UI (`INTERACT`) en los parámetros del netlist.
 *
 * La entrada se persiste en `inputs` (sobrevive a LOAD_CIRCUIT/RESET: el
 * solver no ve el documento, solo el netlist). Solo se tocan parámetros
 * eléctricos declarados para la primitiva: entradas meramente visuales
 * (temperatura, humedad, distancia, ángulo) no deben obligar a re-resolver
 * el circuito. Devuelve `true` si algún parámetro eléctrico cambió.
 */
export function setComponentInput(
    netlist: Netlist | null,
    componentId: string,
    field: string,
    value: unknown,
    inputs?: Map<string, Record<string, unknown>>,
): boolean {
    if (inputs) {
        const bucket = inputs.get(componentId) ?? {};
        bucket[field] = value;
        inputs.set(componentId, bucket);
    }

    if (!netlist) return false;

    const numeric =
        typeof value === 'boolean' ? (value ? 1 : 0) : typeof value === 'number' ? value : Number.NaN;
    if (Number.isNaN(numeric)) return false;

    let changed = false;
    for (const element of netlist.elements) {
        if (element.componentId !== componentId) continue;
        if (!(ELECTRICAL_INPUTS[element.primitive] ?? []).includes(field)) continue;
        if (element.params[field] === numeric) continue;
        element.params[field] = numeric;
        changed = true;
    }
    return changed;
}

/**
 * Aplica los `behaviors` del manifiesto contra la última solución.
 * Devuelve `true` si algún elemento cambió (obliga a re-resolver una vez).
 */
export function applyBehaviors(
    netlist: Netlist,
    components: Array<{ id: string; type: string }>,
    manifests: ComponentManifest[],
    solution: SolverSolution | null,
): boolean {
    const manifestById = new Map(manifests.map((m) => [m.id, m]));
    let changed = false;

    for (const component of components) {
        const behaviors = manifestById.get(component.type)?.behaviors;
        if (!behaviors?.length) continue;

        for (const behavior of behaviors) {
            if (behavior.type !== 'voltageSwitch') continue;

            const coil = netlist.elements.find((e) => e.id === `${component.id}:${behavior.coilElement}`);
            const contact = netlist.elements.find((e) => e.id === `${component.id}:${behavior.switchElement}`);
            if (!coil || !contact) continue;

            const coilVoltage = Math.abs(solution?.elementResults[coil.id]?.voltage ?? 0);
            const active = coilVoltage >= behavior.threshold;
            const closed = behavior.inverted ? !active : active;
            const next = closed ? 1 : 0;

            if (contact.params.closed !== next) {
                contact.params.closed = next;
                changed = true;
            }
        }
    }

    return changed;
}
