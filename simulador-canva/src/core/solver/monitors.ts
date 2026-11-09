import type { ComponentManifest, MonitorSpec, SolverSolution } from '@types';

/**
 * Motor de monitores de daño / reset (contrato `monitors` de los manifiestos).
 *
 * Los manifiestos *declaran* condiciones (`power`/`voltage`/`current` por
 * encima/debajo de un `limit` que debe sostenerse durante `duration` µs
 * virtuales). Este módulo es quien las **evalúa en runtime** y devuelve los
 * eventos a emitir (`COMPONENT_BURNED`, `BROWNOUT_RESET`, …).
 *
 * Diseño:
 *  - No depende del solver ni del worker: recibe `elementResults` y un reloj
 *    virtual, por lo que es determinista y testeable sin timers.
 *  - Mantiene su estado fuera (el worker lo guarda entre ticks), porque la
 *    condición debe acumularse en el tiempo aunque no haya cambios eléctricos
 *    que obliguen a re-resolver la malla.
 *  - Emite **una sola vez por episodio**: cuando la condición deja de cumplirse
 *    se rearma. Sin esto, un brownout perpetuo resetearía el MCU en bucle.
 */

/** Estado de un monitor entre evaluaciones */
export interface MonitorState {
    /** Instante (µs virtuales) en que empezó la violación actual; null = sin violación */
    sinceUs: number | null;
    /** Ya se emitió el evento por esta violación */
    fired: boolean;
}

/** Clave: `${elementId}#${índice del monitor en el manifiesto}` */
export type MonitorStates = Map<string, MonitorState>;

export interface MonitorEvent {
    /** Nombre declarado en el manifiesto: COMPONENT_BURNED, BROWNOUT_RESET, … */
    event: string;
    /** `elementId` o `componentId` según `scope` */
    sourceId: string;
    componentId: string;
    /** `${componentId}:${monitor.element}` */
    elementId: string;
    action: MonitorSpec['action'];
    /** Valor observado que disparó la condición */
    value: number;
    monitor: MonitorSpec;
}

export interface EvaluateMonitorsInput {
    components: Array<{ id: string; type: string }>;
    manifests: ComponentManifest[];
    elementResults: SolverSolution['elementResults'];
    /** Tiempo virtual actual (µs) */
    virtualTimeUs: number;
    states: MonitorStates;
}

export function createMonitorStates(): MonitorStates {
    return new Map();
}

/**
 * Evalúa todos los monitores de los componentes cargados contra los últimos
 * resultados del solver. Devuelve los eventos que deben emitirse en este tick
 * y actualiza `states` (se encarga de la ventana de duración y del rearme).
 */
export function evaluateMonitors(input: EvaluateMonitorsInput): MonitorEvent[] {
    const { components, manifests, elementResults, virtualTimeUs, states } = input;
    const manifestById = new Map(manifests.map((m) => [m.id, m]));
    const events: MonitorEvent[] = [];

    for (const comp of components) {
        const manifest = manifestById.get(comp.type);
        const monitors = manifest?.monitors;
        if (!monitors || monitors.length === 0) continue;

        for (let i = 0; i < monitors.length; i++) {
            const monitor = monitors[i];
            const elementId = `${comp.id}:${monitor.element}`;
            const result = elementResults[elementId];
            if (!result) continue;

            const value = result[monitor.quantity];
            if (typeof value !== 'number') continue;

            const breached = monitor.comparison === 'above' ? value > monitor.limit : value < monitor.limit;
            const key = `${elementId}#${i}`;
            let state = states.get(key);
            if (!state) {
                state = { sinceUs: null, fired: false };
                states.set(key, state);
            }

            if (!breached) {
                // Condición restablecida: se rearma para el próximo episodio
                state.sinceUs = null;
                state.fired = false;
                continue;
            }
            if (state.fired) continue;

            if (state.sinceUs === null) state.sinceUs = virtualTimeUs;

            const elapsedUs = virtualTimeUs - state.sinceUs;
            if (elapsedUs < monitor.duration) continue; // aún no se sostuvo el tiempo mínimo

            state.fired = true;
            events.push({
                event: monitor.event,
                sourceId: monitor.scope === 'component' ? comp.id : elementId,
                componentId: comp.id,
                elementId,
                action: monitor.action,
                value,
                monitor,
            });
        }
    }

    return events;
}
