import { PROTOCOL_VERSION } from '@types';
import type { UICommand, WorkerEvent } from '@types';
import type { Netlist, SolverSolution } from '@types';
import type { SimulationProjection } from '@types';
import type { ComponentManifest } from '@types';
import { buildNetlist, solve } from '@core/solver';
import { ArduinoCore } from '@core/runtime/arduinoCore';
import { cppSubsetBackend } from '@core/runtime/cppSubsetBackend';
import type { LanguageBackend } from '@types';

interface RuntimeProc {
    backend: LanguageBackend;
    instance: unknown;
    core: ArduinoCore;
    mcuComponentId: string;
    dirty: boolean;
}

let activeRuntime: RuntimeProc | null = null;
let storedManifests: ComponentManifest[] = [];
let storedProjection: SimulationProjection | null = null;

function getGpioStates() {
    return activeRuntime?.core.getGpioStates();
}

/** Ejecuta el solver con el estado GPIO actual y actualiza voltajes de pines en el core */
function runSolver() {
    if (!netlist) return;
    solution = solve(netlist, getGpioStates());
    sendSolverResult();
    if (activeRuntime) {
        for (const elem of netlist.elements) {
            if (elem.primitive === 'gpio' && elem.params.gpioNumber !== undefined) {
                const padNet = elem.terminals.pad;
                activeRuntime.core.setPinVoltage(
                    elem.params.gpioNumber,
                    padNet ? (solution.nodeVoltages[padNet] ?? 0) : 0,
                );
            }
        }
    }
    if (!solution.converged) {
        // No se detiene el reloj: el tiempo virtual sigue avanzando y el
        // diagnóstico queda visible en el panel. Solo el sketch sigue
        // pausado en sus delay() (eso es lo esperado).
        sendEvent('SOLVER_FAULT', 'solver', {
            diagnostics: solution.diagnostics,
            iterations: solution.iterations,
        });
    }
}

/** Ejecuta el runtime (setup/loop) hasta dormir, preempt o fault */
function runRuntime(proc: RuntimeProc) {
    const result = proc.backend.resume(proc.instance, virtualTimeUs + stepUs);
    const wasDirty = proc.dirty;
    proc.dirty = false;
    switch (result.type) {
        case 'sleeping':
            processQueue.push({
                wakeUpTimeUs: result.wakeUpTimeUs,
                componentId: proc.mcuComponentId,
                data: { runtime: true },
            });
            processQueue.sort((a, b) => a.wakeUpTimeUs - b.wakeUpTimeUs);
            break;
        case 'preempted':
            // loop() sin delay: continuar en el próximo tick
            processQueue.push({
                wakeUpTimeUs: virtualTimeUs,
                componentId: proc.mcuComponentId,
                data: { runtime: true },
            });
            break;
        case 'reset':
            proc.backend.reset(proc.instance);
            processQueue.push({
                wakeUpTimeUs: virtualTimeUs,
                componentId: proc.mcuComponentId,
                data: { runtime: true },
            });
            break;
        case 'faulted':
            simState = 'faulted';
            sendStatus();
            sendEvent('RUNTIME_FAULT', proc.mcuComponentId, result.diagnostic);
            stopTimer();
            return;
    }
    if (wasDirty) {
        eventQueue.push({ virtualTimeUs, eventType: 'GPIO_CHANGED', sourceId: proc.mcuComponentId, data: {} });
    }
}

/* ======================================================================== */
/*  Worker de simulación de circuitos                                       */
/*                                                                          */
/*  Comunicación con el canvas siguiendo @types/protocol (v1.0.0):          */
/*  - UICommand   <- mensajes del hilo principal (canvas)                   */
/*  - WorkerEvent -> mensajes enviados al hilo principal                    */
/*                                                                          */
/*  Arquitectura:                                                           */
/*  1. Reloj principal: paso fijo determinista en virtualTimeUs.            */
/*  2. Solver eléctrico: disparo por eventos (solo recalcula cuando hay     */
/*     cambios de topología, GPIO, parámetros o interacción de UI).         */
/*  3. Runtime C++/MCU: cola de procesos ordenada por wakeUpTimeUs.         */
/* ======================================================================== */

/* ------------------------------------------------------------------ */
/*  Estado del worker                                                 */
/* ------------------------------------------------------------------ */

let simState: 'idle' | 'running' | 'paused' | 'faulted' = 'idle';
let virtualTimeUs = 0;
let stepUs = 1000; // paso por defecto: 1 ms virtual

let netlist: Netlist | null = null;
let solution: SolverSolution | null = null;

let snapshotSeq = 0;
let lastSentState: Record<string, Record<string, unknown>> = {};

let eventQueue: Array<{
    virtualTimeUs: number;
    eventType: string;
    sourceId: string;
    data: unknown;
}> = [];

let processQueue: Array<{
    wakeUpTimeUs: number;
    componentId: string;
    data: unknown;
}> = [];

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

            if (type === 'full' || JSON.stringify(prev) !== JSON.stringify(current)) {
                changes[elementId] = current;
                lastSentState[elementId] = current;
            }
        }
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

/** Publica el resultado del solver (convergencia, diagnósticos, voltajes) vía EVENT */
function sendSolverResult(): void {
    if (!solution) return;
    sendEvent('SOLVER_RESULT', 'solver', {
        converged: solution.converged,
        diagnostics: solution.diagnostics,
        iterations: solution.iterations,
        nodeVoltages: solution.nodeVoltages,
    });
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
 * Un tic del reloj. Avanza virtualTimeUs en stepUs, ejecuta el solver
 * si hay eventos pendientes, despierta procesos del runtime C++ y emite
 * snapshots.
 */
function tick(): void {
    if (simState !== 'running') return;

    // 1. Despertar procesos del runtime C++ cuyo wakeUpTimeUs <= virtualTimeUs
    const readyProcesses = processQueue.filter((p) => p.wakeUpTimeUs <= virtualTimeUs);
    processQueue = processQueue.filter((p) => p.wakeUpTimeUs > virtualTimeUs);

    for (const proc of readyProcesses) {
        const data = proc.data as { runtime?: boolean } | null;
        if (data?.runtime && activeRuntime && activeRuntime.mcuComponentId === proc.componentId) {
            runRuntime(activeRuntime);
        } else {
            sendEvent('PROCESS_WAKE', proc.componentId, proc.data);
        }
    }

    // 2. Si hay eventos pendientes del solver, recalcular
    const hasPendingEvents = eventQueue.length > 0;
    if (hasPendingEvents) {
        eventQueue = [];
        runSolver();
    }

    // 3. Avanzar tiempo virtual
    virtualTimeUs += stepUs;

    // 4. Emitir snapshot delta
    sendSnapshot('delta');

    // 5. Programar siguiente tic
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
            stopTimer();
            simState = 'idle';
            virtualTimeUs = 0;
            snapshotSeq = 0;
            lastSentState = {};
            eventQueue = [];
            processQueue = [];
            if (activeRuntime) {
                activeRuntime.backend.dispose(activeRuntime.instance);
                activeRuntime = null;
            }

            const { projection, manifests } = cmd.payload;
            storedProjection = projection as SimulationProjection;
            storedManifests = manifests as ComponentManifest[];
            try {
                netlist = buildNetlist(storedProjection, storedManifests);
                runSolver();
                simState = 'idle';
                sendStatus();
                sendSnapshot('full');
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
            try {
                const compiled = cppSubsetBackend.compile(source, 'esp32@1');
                if (compiled.diagnostics.length > 0 || !compiled.program) {
                    sendEvent('COMPILE_ERROR', mcuComponentId, compiled.diagnostics);
                    break;
                }
                const mcuComp = storedProjection?.components.find((c) => c.id === mcuComponentId);
                const manifest = storedManifests.find((m) => m.id === mcuComp?.type);
                if (!manifest) {
                    sendEvent('COMPILE_ERROR', mcuComponentId, [
                        { severity: 'error', code: 'MCU_NOT_FOUND', message: `MCU ${mcuComponentId} sin manifiesto`, line: 1, column: 1 },
                    ]);
                    break;
                }
                const procRef: { current: RuntimeProc | null } = { current: null };
                const core = new ArduinoCore({
                    manifest,
                    clock: () => virtualTimeUs,
                    onDirty: () => {
                        if (procRef.current) procRef.current.dirty = true;
                    },
                    onSerial: (text) => sendEvent('SERIAL', mcuComponentId, text),
                });
                const instance = cppSubsetBackend.createInstance(compiled.program, core);
                const proc: RuntimeProc = { backend: cppSubsetBackend, instance, core, mcuComponentId, dirty: false };
                procRef.current = proc;
                activeRuntime = proc;
                sendEvent('PROGRAM_LOADED', mcuComponentId, { source });
                processQueue.push({
                    wakeUpTimeUs: virtualTimeUs,
                    componentId: mcuComponentId,
                    data: { runtime: true },
                });
                processQueue.sort((a, b) => a.wakeUpTimeUs - b.wakeUpTimeUs);
                // Recalcular el circuito con los GPIO en estado inicial
                runSolver();
                sendSnapshot('full');
            } catch (err) {
                sendEvent('RUNTIME_FAULT', mcuComponentId, String(err));
            }
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
                    sendStatus();
                    break;

                case 'RESET':
                    simState = 'idle';
                    stopTimer();
                    virtualTimeUs = 0;
                    if (activeRuntime) {
                        activeRuntime.core.reset();
                        activeRuntime.backend.reset(activeRuntime.instance);
                        processQueue.push({
                            wakeUpTimeUs: 0,
                            componentId: activeRuntime.mcuComponentId,
                            data: { runtime: true },
                        });
                    }
                    runSolver();
                    lastSentState = {};
                    sendStatus();
                    sendSnapshot('full');
                    break;

                case 'STEP': {
                    const step = newStepUs ?? stepUs;
                    if (activeRuntime) runRuntime(activeRuntime);
                    virtualTimeUs += step;
                    runSolver();
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
