import { PROTOCOL_VERSION } from '@types';
import type { UICommand, WorkerEvent } from '@types';
import type { Netlist, SolverSolution } from '@types';
import type { SimulationProjection } from '@types';
import type { ComponentManifest } from '@types';
import type { GpioStateIndex } from '@core/runtime/gpioState';
import { addGpioStates } from '@core/runtime/gpioState';
import { ArduinoCore } from '@core/runtime/arduinoCore';
import { cppSubsetBackend } from '@core/runtime/cppSubsetBackend';
import { buildNetlist, solve, evaluateMonitors, createMonitorStates } from '@core/solver';
import type { MonitorEvent, MonitorStates } from '@core/solver';

/* ======================================================================== */
/*  Worker de simulación de circuitos                                       */
/*                                                                          */
/*  Comunicación con el canvas siguiendo @types/protocol (v1.0.0):          */
/*  - UICommand   <- mensajes del hilo principal (canvas)                   */
/*  - WorkerEvent -> mensajes enviados al hilo principal                    */
/*                                                                          */
/*  Arquitectura:                                                           */
/*  1. Reloj principal: paso fijo determinista en virtualTimeUs.            */
/*  2. Runtime C++/MCU: ArduinoCore + cppSubsetBackend (setup/loop) que     */
/*     duerme por delay() y despierta según wakeUpTimeUs.                   */
/*  3. Solver eléctrico: Newton-Raphson por eventos (topología, GPIO o      */
/*     interacción de UI). Los GPIO se resuelven con el estado del core.    */
/* ======================================================================== */

/* ------------------------------------------------------------------ */
/*  Estado del worker                                                 */
/* ------------------------------------------------------------------ */

let simState: 'idle' | 'running' | 'paused' | 'faulted' = 'idle';
let virtualTimeUs = 0;
let stepUs = 1000; // paso por defecto: 1 ms virtual

let netlist: Netlist | null = null;
let solution: SolverSolution | null = null;

/** Última proyección/manifiestos cargados: los consumen los monitores de daño */
let loadedComponents: Array<{ id: string; type: string }> = [];
let loadedManifests: ComponentManifest[] = [];

/**
 * Estado acumulado de los monitores (`COMPONENT_BURNED`, `BROWNOUT_RESET`, …).
 * Vive en el worker porque una condición puede sostenerse durante miles de
 * ticks sin que haya cambios eléctricos que obliguen a re-resolver la malla.
 */
let monitorStates: MonitorStates = createMonitorStates();

/** El solver debe recalcularse: cambió un GPIO (pinMode/digitalWrite) o la topología */
let gpioDirty = false;

let snapshotSeq = 0;
let lastSentState: Record<string, Record<string, unknown>> = {};

let eventQueue: Array<{
    virtualTimeUs: number;
    eventType: string;
    sourceId: string;
    data: unknown;
}> = [];

/**
 * Runtime C++ de cada MCU del circuito: núcleo Arduino (estados GPIO) más
 * la instancia del sketch compilado. `wakeUpTimeUs` es el instante virtual
 * en el que el sketch vuelve a ejecutarse (fin del delay() o siguiente tick).
 */
interface McuRuntime {
    id: string;
    manifest: ComponentManifest;
    core: ArduinoCore;
    instance: unknown;
    wakeUpTimeUs: number;
    running: boolean;
}

let mcuRuntimes = new Map<string, McuRuntime>();

let timerId: number | null = null;

/* ------------------------------------------------------------------ */
/*  Utilidades de mensajería                                          */
/* ------------------------------------------------------------------ */

function post(event: WorkerEvent): void {
    self.postMessage(event);
}

function sendStatus(): void {
    post({
        type: 'STATUS',
        payload: { state: simState, virtualTimeUs },
    });
}

/**
 * Cadencia mínima de los snapshots "vacíos": el panel muestra `t_virtual`, así
 * que se mantiene un latido (~4 Hz virtual), pero sin inundar el hilo
 * principal. Antes se posteaba uno por tick: con el paso por defecto de 1 ms
 * eran ~1000 mensajes/s y un re-render del panel por cada uno.
 */
const SNAPSHOT_KEEPALIVE_US = 250_000;
let lastDeltaSentUs = 0;

function sendSnapshot(type: 'full' | 'delta'): void {
    const changes: Record<string, Record<string, unknown>> = {};

    if (solution) {
        for (const [elementId, result] of Object.entries(solution.elementResults)) {
            const prev = lastSentState[elementId] ?? {};
            const current: Record<string, unknown> = {
                voltage: result.voltage,
                current: result.current,
                power: result.power,
            };
            if (result.conducting !== undefined) {
                current.conducting = result.conducting;
            }
            if (result.destroyed !== undefined) {
                current.destroyed = result.destroyed;
            }

            if (type === 'full' || JSON.stringify(prev) !== JSON.stringify(current)) {
                changes[elementId] = current;
                lastSentState[elementId] = current;
            }
        }
    }

    if (type === 'delta') {
        const hasChanges = Object.keys(changes).length > 0;
        if (!hasChanges && virtualTimeUs - lastDeltaSentUs < SNAPSHOT_KEEPALIVE_US) return;
        lastDeltaSentUs = virtualTimeUs;
    }

    post({
        type: 'SNAPSHOT',
        payload: {
            seq: ++snapshotSeq,
            virtualTimeUs,
            type,
            changes,
        },
    });
}

function sendEvent(eventType: string, sourceId: string, data: unknown): void {
    post({
        type: 'EVENT',
        payload: { virtualTimeUs, eventType, sourceId, data },
    });
}

/* ------------------------------------------------------------------ */
/*  Runtime C++ / MCU                                                 */
/* ------------------------------------------------------------------ */

/** `Serial.println` agrega '\n'; el monitor serie de la UI ya separa líneas. */
function stripTrailingNewline(text: string): string {
    return text.endsWith('\n') ? text.slice(0, -1) : text;
}

/**
 * Salida serie con loteo y tope.
 *
 * Sin esto, un `Serial.println` en un `loop()` sin `delay()` posteaba un
 * mensaje por línea: ~666 por tick (presupuesto de 2000 steps). Eso inundaba
 * la cola de mensajes del hilo principal (`console.log` + re-render por
 * mensaje) hasta que ni `PAUSE`/`RESET` se procesaban y el reloj virtual
 * parecía congelado.
 *
 * Ahora las líneas se acumulan y se publican como UN evento por MCU cada
 * `SERIAL_FLUSH_INTERVAL_US` virtuales, con un tope de líneas por lote; el
 * resto se descarta con un aviso (como el UART real, que también satura).
 */
const SERIAL_FLUSH_INTERVAL_US = 10_000;
const MAX_SERIAL_LINES_PER_FLUSH = 100;
const serialBuffer = new Map<string, { lines: string[]; dropped: number }>();
let lastSerialFlushUs = 0;

function queueSerial(mcuId: string, text: string): void {
    let entry = serialBuffer.get(mcuId);
    if (!entry) {
        entry = { lines: [], dropped: 0 };
        serialBuffer.set(mcuId, entry);
    }
    if (entry.lines.length < MAX_SERIAL_LINES_PER_FLUSH) {
        entry.lines.push(stripTrailingNewline(text));
    } else {
        entry.dropped++;
    }
}

function flushSerial(force = false): void {
    if (!force && virtualTimeUs - lastSerialFlushUs < SERIAL_FLUSH_INTERVAL_US) return;
    lastSerialFlushUs = virtualTimeUs;
    if (serialBuffer.size === 0) return;

    for (const [mcuId, entry] of serialBuffer) {
        if (entry.lines.length === 0 && entry.dropped === 0) continue;
        const lines = [...entry.lines];
        if (entry.dropped > 0) {
            lines.push(`… (${entry.dropped} líneas serie omitidas por exceso)`);
        }
        sendEvent('SERIAL', mcuId, lines.join('\n'));
    }
    serialBuffer.clear();
}

/** Crea un ArduinoCore por cada componente con `mcu` en su manifiesto. */
function createMcuRuntimes(projection: SimulationProjection, manifests: ComponentManifest[]): void {
    const manifestById = new Map(manifests.map((m) => [m.id, m]));

    for (const comp of projection.components) {
        const manifest = manifestById.get(comp.type);
        if (!manifest?.mcu) continue;

        const id = comp.id;
        const core = new ArduinoCore({
            manifest,
            clock: () => virtualTimeUs,
            onDirty: () => {
                gpioDirty = true;
            },
            onSerial: (text) => queueSerial(id, text),
        });

        mcuRuntimes.set(id, {
            id,
            manifest,
            core,
            instance: null,
            wakeUpTimeUs: virtualTimeUs,
            running: false,
        });
    }
}

function disposeMcuRuntimes(): void {
    for (const rt of mcuRuntimes.values()) {
        if (rt.instance) cppSubsetBackend.dispose(rt.instance);
    }
    mcuRuntimes = new Map();
}

/**
 * Compila y prepara un sketch en el MCU indicado.
 * Devuelve false (y emite PROGRAM_ERROR) si el MCU no existe o hay errores.
 */
function loadProgram(mcuComponentId: string, source: string): boolean {
    const rt = mcuRuntimes.get(mcuComponentId);
    if (!rt) {
        sendEvent('PROGRAM_ERROR', mcuComponentId, `No hay MCU "${mcuComponentId}" en el circuito`);
        return false;
    }

    const platform = rt.manifest.mcu?.platform ?? 'esp32@1';
    const { program, diagnostics } = cppSubsetBackend.compile(source, platform);
    if (!program) {
        sendEvent('PROGRAM_ERROR', mcuComponentId, diagnostics);
        return false;
    }

    if (rt.instance) cppSubsetBackend.dispose(rt.instance);
    rt.core.reset(); // los pines vuelven a alta impedancia hasta que pinMode() diga lo contrario
    rt.instance = cppSubsetBackend.createInstance(program, rt.core);
    rt.wakeUpTimeUs = virtualTimeUs;
    rt.running = true;
    gpioDirty = true;
    return true;
}

/** Ejecuta los sketches cuyo `wakeUpTimeUs` ya llegó en el tiempo virtual. */
function runMcuSketches(): void {
    for (const rt of mcuRuntimes.values()) {
        if (!rt.running || !rt.instance) continue;
        if (rt.wakeUpTimeUs > virtualTimeUs) continue;

        const result = cppSubsetBackend.resume(rt.instance, virtualTimeUs);
        switch (result.type) {
            case 'sleeping':
                // delay()/delayMicroseconds(): el sketch se suspende hasta esa marca
                rt.wakeUpTimeUs = result.wakeUpTimeUs;
                break;
            case 'preempted':
                // Presupuesto de instrucciones agotado: continúa en el próximo tick
                rt.wakeUpTimeUs = virtualTimeUs;
                break;
            case 'faulted':
                rt.running = false;
                sendEvent('PROGRAM_FAULT', rt.id, result.diagnostic);
                break;
            case 'reset':
                cppSubsetBackend.reset(rt.instance);
                rt.wakeUpTimeUs = virtualTimeUs;
                break;
        }
    }
}

/**
 * Estados GPIO de todos los MCU, indexados por `componentId:gpio`.
 *
 * La clave lleva el componente a propósito: dos ESP32 con el mismo GPIO
 * (el 2 del sketch por defecto) deben conservar cada uno su propio estado.
 */
function collectGpioStates(): GpioStateIndex | undefined {
    if (mcuRuntimes.size === 0) return undefined;
    const index: GpioStateIndex = new Map();
    for (const rt of mcuRuntimes.values()) {
        addGpioStates(index, rt.id, rt.core.getGpioStates());
    }
    return index;
}

/** Devuelve al core el voltaje observado por el solver en cada pad. */
function syncPadVoltages(): void {
    if (!netlist || !solution) return;
    for (const rt of mcuRuntimes.values()) {
        const prefix = `${rt.id}:`;
        for (const elem of netlist.elements) {
            if (elem.primitive !== 'gpio' || !elem.id.startsWith(prefix)) continue;
            const gpio = elem.params.gpioNumber;
            if (gpio === undefined) continue;
            rt.core.setPinVoltage(gpio, solution.nodeVoltages[elem.terminals.pad ?? ''] ?? 0);
        }
    }
}

/**
 * Resuelve el circuito con el estado actual de los GPIO, reparte los voltajes
 * de pad entre los MCU y publica el resultado (SOLVER_RESULT).
 */
function solveAndEmit(): void {
    if (!netlist) return;

    solution = solve(netlist, collectGpioStates());
    syncPadVoltages();
    gpioDirty = false;

    sendEvent('SOLVER_RESULT', 'solver', {
        converged: solution.converged,
        diagnostics: solution.diagnostics,
        iterations: solution.iterations,
        nodeVoltages: solution.nodeVoltages,
    });
}

/**
 * Emite los eventos de los monitores que se dispararon y aplica su `action`:
 *  - `destroy` → abre el componente en el netlist (se re-resuelve en el mismo
 *    tick, antes del snapshot, para que la UI lo vea cortado de inmediato)
 *  - `reset`   → reinicia el MCU (el sketch vuelve a `setup()` y los pines a
 *    alta impedancia): es lo que hace un Brownout Reset
 *  - `notify`  → solo el evento
 */
function applyMonitorEvents(events: MonitorEvent[]): void {
    let openedCircuit = false;

    for (const ev of events) {
        sendEvent(ev.event, ev.sourceId, {
            componentId: ev.componentId,
            elementId: ev.elementId,
            action: ev.action,
            quantity: ev.monitor.quantity,
            value: ev.value,
            limit: ev.monitor.limit,
            comparison: ev.monitor.comparison,
            durationUs: ev.monitor.duration,
        });

        switch (ev.action) {
            case 'destroy': {
                const elem = netlist?.elements.find((e) => e.id === ev.elementId);
                if (elem && elem.params.destroyed !== 1) {
                    elem.params.destroyed = 1;
                    openedCircuit = true;
                }
                break;
            }
            case 'reset': {
                const rt = mcuRuntimes.get(ev.componentId);
                if (rt) {
                    rt.core.reset();
                    if (rt.instance) cppSubsetBackend.reset(rt.instance);
                    rt.wakeUpTimeUs = virtualTimeUs;
                    gpioDirty = true;
                }
                break;
            }
            case 'notify':
            default:
                break;
        }
    }

    if (openedCircuit) solveAndEmit();
}

/**
 * Evalúa todos los monitores cargados contra los últimos resultados, en cada
 * tick (no solo al resolver): la condición se acumula en tiempo virtual aunque
 * no cambie nada eléctrico, que es justamente el caso "sostenido > 1.5 s".
 */
function evaluateMonitorTick(): void {
    if (!solution) return;
    const fired = evaluateMonitors({
        components: loadedComponents,
        manifests: loadedManifests,
        elementResults: solution.elementResults,
        virtualTimeUs,
        states: monitorStates,
    });
    if (fired.length > 0) applyMonitorEvents(fired);
}

/* ------------------------------------------------------------------ */
/*  Reloj y planificador                                              */
/* ------------------------------------------------------------------ */

function stopTimer(): void {
    if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
    }
}

function startTimer(delayMs: number): void {
    stopTimer();
    timerId = setTimeout(tick, delayMs) as unknown as number;
}

/**
 * Un tic del reloj. Ejecuta los sketches hasta su próximo delay(), resuelve
 * si hay cambios eléctricos, avanza virtualTimeUs y emite snapshots.
 */
function tick(): void {
    if (simState !== 'running') return;

    // 1. Ejecutar los sketches del runtime C++ (setup/loop hasta delay())
    runMcuSketches();

    // 2. Recalcular si hay eventos de topología o si un GPIO cambió de estado
    const hasPendingEvents = eventQueue.length > 0;
    if (hasPendingEvents || gpioDirty) {
        eventQueue = [];

        if (netlist) {
            solveAndEmit();
            if (!solution?.converged) {
                simState = 'faulted';
                sendStatus();
                stopTimer();
                return;
            }
        }
    }

    // 3. Avanzar tiempo virtual
    virtualTimeUs += stepUs;

    // 4. Monitores de daño/reset: pueden abrir un componente o resetear el MCU
    evaluateMonitorTick();

    // 5. Emitir salida serie acumulada (lote acotado: un loop con println
    //    no debe inundar el hilo principal)
    flushSerial();

    // 6. Emitir snapshot delta (con latido mínimo para que t_virtual avance)
    sendSnapshot('delta');

    // 7. Programar siguiente tic
    const delayMs = Math.max(1, stepUs / 1000);
    startTimer(delayMs);
}

/* ------------------------------------------------------------------ */
/*  Manejo de comandos UI                                             */
/* ------------------------------------------------------------------ */

self.addEventListener('message', (event: MessageEvent<UICommand>) => {
    const cmd = event.data;

    switch (cmd.type) {
        case 'HELLO': {
            post({
                type: 'READY',
                payload: { version: PROTOCOL_VERSION, catalogVersion: '1.0.0' },
            });
            sendStatus();
            break;
        }

        case 'LOAD_CIRCUIT': {
            // Se conserva el estado de ejecución: si estaba corriendo, el
            // circuito recargado sigue corriendo (con los programas del doc).
            const wasRunning = simState === 'running';

            stopTimer();
            simState = 'idle';
            virtualTimeUs = 0;
            snapshotSeq = 0;
            lastSentState = {};
            lastDeltaSentUs = 0;
            eventQueue = [];
            gpioDirty = false;
            monitorStates = createMonitorStates();
            serialBuffer.clear();
            lastSerialFlushUs = 0;

            const { projection, manifests: incoming } = cmd.payload;
            try {
                disposeMcuRuntimes();
                const proj = projection as SimulationProjection;
                const list = incoming as ComponentManifest[];

                loadedComponents = proj.components;
                loadedManifests = list;

                netlist = buildNetlist(proj, list);
                createMcuRuntimes(proj, list);

                // Sketches guardados en el documento (sobreviven a cambios de topología)
                for (const prog of proj.programs ?? []) {
                    loadProgram(prog.mcuComponentId, prog.source);
                }

                solveAndEmit();

                // El monitor serie arranca vacío con cada circuito cargado
                sendEvent('SERIAL_RESET', 'system', null);
                simState = wasRunning ? 'running' : 'idle';
                sendStatus();
                sendSnapshot('full');
                if (wasRunning) tick();
            } catch (err) {
                simState = 'faulted';
                sendStatus();
                sendEvent('SOLVER_FAULT', 'system', String(err));
            }
            break;
        }

        case 'PATCH_CIRCUIT': {
            eventQueue.push({
                virtualTimeUs,
                eventType: 'TOPOLOGY_CHANGED',
                sourceId: 'ui',
                data: cmd.payload,
            });
            break;
        }

        case 'SET_PROGRAM': {
            const { mcuComponentId, source } = cmd.payload;
            // Solo compila/carga el sketch: la simulación NO arranca sola.
            // Para ejecutar, el usuario pulsa ▶ Run (CONTROL START).
            loadProgram(mcuComponentId, source);
            break;
        }

        case 'CONTROL': {
            const { action, stepUs: newStepUs } = cmd.payload;

            if (newStepUs !== undefined) {
                stepUs = newStepUs;
            }

            switch (action) {
                case 'START':
                    simState = 'running';
                    sendStatus();
                    tick();
                    break;

                case 'PAUSE':
                    simState = 'paused';
                    stopTimer();
                    flushSerial(true); // lo acumulado hasta acá se muestra al pausar
                    sendStatus();
                    break;

                case 'RESET':
                    simState = 'idle';
                    stopTimer();
                    virtualTimeUs = 0;
                    lastDeltaSentUs = 0;
                    serialBuffer.clear();
                    lastSerialFlushUs = 0;
                    // El reset restaura el circuito: los monitores rearman y los
                    // componentes destruidos vuelven a estar intactos
                    monitorStates = createMonitorStates();
                    if (netlist) {
                        for (const elem of netlist.elements) {
                            if (elem.params.destroyed === 1) elem.params.destroyed = 0;
                        }
                    }
                    // Los sketches vuelven a setup() y los pines a alta impedancia
                    for (const rt of mcuRuntimes.values()) {
                        rt.core.reset();
                        if (rt.instance) cppSubsetBackend.reset(rt.instance);
                        rt.wakeUpTimeUs = 0;
                        rt.running = rt.instance !== null;
                    }
                    gpioDirty = true;
                    if (netlist) {
                        solveAndEmit();
                        lastSentState = {};
                    }
                    // El monitor serie se limpia: la salida anterior era del run anterior
                    sendEvent('SERIAL_RESET', 'system', null);
                    sendStatus();
                    sendSnapshot('full');
                    break;

                case 'STEP': {
                    const step = newStepUs ?? stepUs;
                    runMcuSketches();
                    if (netlist) {
                        solveAndEmit();
                    }
                    virtualTimeUs += step;
                    evaluateMonitorTick();
                    flushSerial(true);
                    sendStatus();
                    sendSnapshot('full');
                    break;
                }
            }
            break;
        }

        case 'INTERACT': {
            const { componentId, field, value } = cmd.payload;
            eventQueue.push({
                virtualTimeUs,
                eventType: 'COMPONENT_INTERACT',
                sourceId: componentId,
                data: { field, value },
            });
            break;
        }

        case 'ACK_SNAPSHOT': {
            // Control de flujo de snapshots (opcional).
            break;
        }
    }
});

/* ------------------------------------------------------------------ */
/*  Heartbeat                                                         */
/* ------------------------------------------------------------------ */

const HEARTBEAT_MS = 2000;
let hbTimer: number | null = null;

function startHeartbeat(): void {
    if (hbTimer !== null) return;
    hbTimer = setInterval(() => {
        post({
            type: 'HEARTBEAT',
            payload: { realTimeMs: Date.now() },
        });
    }, HEARTBEAT_MS) as unknown as number;
}

startHeartbeat();
