export type SimStatus = 'idle' | 'running' | 'paused' | 'faulted' | 'unknown';

export interface SimLogEntry {
    timeUs: number;
    text: string;
}

export interface SimulationSnapshot {
    virtualTimeUs: number;
    status: SimStatus;
    /** elementId -> { voltage, current, power, conducting? } */
    states: Record<string, Record<string, unknown>>;
    log: SimLogEntry[];
    lastSeq: number;
    converged: boolean | null;
    diagnostics: string[];
    iterations: number | null;
    serial: SimLogEntry[];
}

export class SimulationStore {
    private snapshot: SimulationSnapshot = {
        virtualTimeUs: 0,
        status: 'unknown',
        states: {},
        log: [],
        lastSeq: 0,
        converged: null,
        diagnostics: [],
        iterations: null,
        serial: [],
    };
    private listeners = new Set<() => void>();

    private rebuild(patch: Partial<SimulationSnapshot>) {
        this.snapshot = { ...this.snapshot, ...patch };
        this.listeners.forEach((l) => l());
    }

    private pushLog(text: string) {
        const entry: SimLogEntry = { timeUs: this.snapshot.virtualTimeUs, text };
        const log = [...this.snapshot.log.slice(-199), entry];
         
        console.log(`[sim t=${entry.timeUs}us] ${text}`);
        return log;
    }

    public applySnapshot(
        virtualTimeUs: number,
        changes: Record<string, Record<string, unknown>>,
        seq = 0,
        type: 'full' | 'delta' = 'delta',
    ) {
        // 'full' es el estado completo del circuito (tras LOAD_CIRCUIT, RESET o
        // STEP): reemplaza todo, para que los elementos de un componente
        // eliminado no queden "fantasma" en el panel. 'delta' fusiona.
        const states: Record<string, Record<string, unknown>> = type === 'full' ? {} : { ...this.snapshot.states };
        for (const [id, delta] of Object.entries(changes)) {
            states[id] = { ...states[id], ...delta };
        }
        const log = this.pushLog(
            `SNAPSHOT seq=${seq} (${Object.keys(changes).length} cambios): ` +
                Object.entries(changes)
                    .map(([id, s]) => `${id} V=${fmt(s.voltage)} I=${fmt(s.current)} P=${fmt(s.power)}${s.conducting === true ? ' ON' : ''}`)
                    .join(' · ') || '(sin cambios)',
        );
        this.rebuild({ virtualTimeUs, states, log, lastSeq: seq });
    }

    public applyStatus(status: SimStatus, virtualTimeUs: number) {
        const log = this.pushLog(`STATUS -> ${status}`);
        this.rebuild({ status, virtualTimeUs, log });
    }

    public applyEvent(eventType: string, sourceId: string, data: unknown) {
        if (eventType === 'SERIAL_RESET') {
            // Reset / circuito recargado: el monitor serie arranca vacío
            this.rebuild({ serial: [] });
            return;
        }
        if (eventType === 'SERIAL') {
            const entry: SimLogEntry = { timeUs: this.snapshot.virtualTimeUs, text: String(data ?? '') };
            const serial = [...this.snapshot.serial.slice(-99), entry];
             
            console.log(`[serial ${sourceId}] ${entry.text}`);
            this.rebuild({ serial });
            return;
        }
        if (eventType === 'PROGRAM_ERROR' || eventType === 'PROGRAM_FAULT') {
            const log = this.pushLog(`⚠ ${eventType} en ${sourceId}: ${formatDiagnostics(data)}`);
            this.rebuild({ log });
            return;
        }
        if (eventType === 'SOLVER_RESULT' && data && typeof data === 'object') {
            const d = data as { converged?: boolean; diagnostics?: string[]; iterations?: number; nodeVoltages?: Record<string, number> };
            const log = this.pushLog(
                `SOLVER converged=${d.converged} iter=${d.iterations} diag=[${(d.diagnostics ?? []).join(',')}] ` +
                    `nodos: ${Object.entries(d.nodeVoltages ?? {}).map(([n, v]) => `${n}=${fmt(v)}V`).join(' ')}`,
            );
            this.rebuild({
                converged: d.converged ?? null,
                diagnostics: d.diagnostics ?? [],
                iterations: d.iterations ?? null,
                log,
            });
            return;
        }
        const log = this.pushLog(`EVENT ${eventType} from ${sourceId}: ${safeStringify(data)}`);
        this.rebuild({ log });
    }

    public applyReady(version: string, catalogVersion: string) {
        const log = this.pushLog(`READY protocol=${version} catalog=${catalogVersion}`);
        this.rebuild({ log, status: 'idle' });
    }

    public applyHeartbeat(realTimeMs: number) {
        // Solo consola, sin re-render
         
        console.log(`[sim] HEARTBEAT ${realTimeMs}`);
    }

    /** Vacía el monitor serie (botón "Limpiar" de la consola UART). */
    public clearSerial() {
        this.rebuild({ serial: [] });
    }

    public getSnapshot(): SimulationSnapshot {
        return this.snapshot;
    }

    public getComponentState(componentId: string) {
        return this.snapshot.states[componentId] || {};
    }

    public getVirtualTimeUs() {
        return this.snapshot.virtualTimeUs;
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

function fmt(v: unknown): string {
    return typeof v === 'number' ? Number(v.toPrecision(4)).toString() : String(v ?? 0);
}

function safeStringify(v: unknown): string {
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

/** Formatea los diagnósticos del compilador subset (o un mensaje simple). */
function formatDiagnostics(data: unknown): string {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
        return data
            .map((d) => {
                const diag = d as { code?: string; message?: string; line?: number };
                return `${diag.code ?? 'ERROR'} (línea ${diag.line ?? '?'}): ${diag.message ?? safeStringify(d)}`;
            })
            .join(' · ');
    }
    return safeStringify(data);
}

export const simulationStore = new SimulationStore();
