import { PROTOCOL_VERSION } from '@types';
import type { UICommand, WorkerEvent } from '@types';
import type { SimulationProjection, ComponentManifest } from '@types';
import { simulationStore } from '../stores/simulationStore';

/**
 * Cliente del worker de simulación (hilo principal).
 * Crea el worker con Vite worker nativo, hace el handshake HELLO/READY
 * y traduce los WorkerEvent a simulationStore + consola.
 */
class SimulationClient {
    private worker: Worker | null = null;
    private requestId = 0;

    private ensureWorker(): Worker | null {
        if (this.worker) return this.worker;
        if (typeof Worker === 'undefined') {
             
            console.warn('[sim] Worker no disponible en este entorno (tests/jsdom)');
            return null;
        }
        const worker = new Worker(new URL('./circuitWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<WorkerEvent>) => this.handleEvent(e.data);
        worker.onerror = (err) => {
             
            console.error('[sim] Worker error:', err);
            simulationStore.applyEvent('WORKER_ERROR', 'client', String(err.message ?? err));
        };
        this.worker = worker;
        this.post({ type: 'HELLO', payload: { version: PROTOCOL_VERSION }, requestId: String(++this.requestId) });
        return worker;
    }

    private post(cmd: UICommand) {
        const w = this.ensureWorker();
        if (!w) return;
         
        console.log('[sim->worker]', cmd.type, cmd.payload);
        w.postMessage(cmd);
    }

    private handleEvent(event: WorkerEvent) {
         
        console.log('[worker->sim]', event.type, event.payload);
        switch (event.type) {
            case 'READY':
                simulationStore.applyReady(event.payload.version, event.payload.catalogVersion);
                break;
            case 'STATUS':
                simulationStore.applyStatus(event.payload.state, event.payload.virtualTimeUs);
                break;
            case 'SNAPSHOT':
                simulationStore.applySnapshot(event.payload.virtualTimeUs, event.payload.changes, event.payload.seq, event.payload.type);
                this.post({ type: 'ACK_SNAPSHOT', payload: { seq: event.payload.seq } });
                break;
            case 'EVENT':
                simulationStore.applyEvent(event.payload.eventType, event.payload.sourceId, event.payload.data);
                break;
            case 'HEARTBEAT':
                simulationStore.applyHeartbeat(event.payload.realTimeMs);
                break;
        }
    }

    /** Carga (o recarga) el circuito completo en el worker */
    loadCircuit(projection: SimulationProjection, manifests: ComponentManifest[]) {
        this.post({ type: 'LOAD_CIRCUIT', payload: { projection, manifests } });
    }

    /** Cambio incremental de topología */
    patchCircuit(payload: { adds?: unknown[]; removes?: string[]; paramChanges?: unknown[] }) {
        this.post({ type: 'PATCH_CIRCUIT', payload });
    }

    control(action: 'START' | 'PAUSE' | 'RESET' | 'STEP', stepUs?: number) {
        this.post({ type: 'CONTROL', payload: { action, ...(stepUs !== undefined ? { stepUs } : {}) } });
    }

    setProgram(mcuComponentId: string, source: string) {
        this.post({ type: 'SET_PROGRAM', payload: { mcuComponentId, source } });
    }

    interact(componentId: string, field: string, value: unknown) {
        this.post({ type: 'INTERACT', payload: { componentId, field, value } });
    }

    terminate() {
        this.worker?.terminate();
        this.worker = null;
    }
}

export const simulationClient = new SimulationClient();
