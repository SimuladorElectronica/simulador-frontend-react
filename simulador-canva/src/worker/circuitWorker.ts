import { PROTOCOL_VERSION } from '@types';
import type { UICommand, WorkerEvent } from '@types';
import type { Netlist, SolverSolution } from '@types';
import type { SimulationProjection } from '@types';
import type { ComponentManifest } from '@types';
import { buildNetlist, solve } from '@core/solver';

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
        sendEvent('PROCESS_WAKE', proc.componentId, proc.data);
    }

    // 2. Si hay eventos pendientes del solver, recalcular
    const hasPendingEvents = eventQueue.length > 0;
    if (hasPendingEvents) {
        eventQueue = [];

        if (netlist) {
            solution = solve(netlist);
            if (!solution.converged) {
                simState = 'faulted';
                sendStatus();
                stopTimer();
                return;
            }
        }
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

            const { projection, manifests } = cmd.payload;
            try {
                netlist = buildNetlist(projection as SimulationProjection, manifests as ComponentManifest[]);
                solution = solve(netlist);
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
            processQueue.push({
                wakeUpTimeUs: virtualTimeUs,
                componentId: mcuComponentId,
                data: { action: 'LOAD_PROGRAM', source },
            });
            processQueue.sort((a, b) => a.wakeUpTimeUs - b.wakeUpTimeUs);
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
                    if (netlist) {
                        solution = solve(netlist);
                        lastSentState = {};
                    }
                    sendStatus();
                    sendSnapshot('full');
                    break;

                case 'STEP': {
                    const step = newStepUs ?? stepUs;
                    if (netlist) {
                        solution = solve(netlist);
                    }
                    virtualTimeUs += step;
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