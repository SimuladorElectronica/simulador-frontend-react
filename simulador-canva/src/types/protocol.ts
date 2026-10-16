export const PROTOCOL_VERSION = '1.0.0';

export type UICommand =
    | { type: 'HELLO'; payload: { version: string }; requestId: string }
    | { type: 'LOAD_CIRCUIT'; payload: { projection: any; manifests: any[] } }
    | { type: 'PATCH_CIRCUIT'; payload: { adds?: any[]; removes?: string[]; paramChanges?: any[] } }
    | { type: 'SET_PROGRAM'; payload: { mcuComponentId: string; source: string } }
    | { type: 'CONTROL'; payload: { action: 'START' | 'PAUSE' | 'RESET' | 'STEP'; stepUs?: number } }
    | { type: 'INTERACT'; payload: { componentId: string; field: string; value: any } }
    | { type: 'ACK_SNAPSHOT'; payload: { seq: number } };

export type WorkerEvent =
    | { type: 'READY'; payload: { version: string; catalogVersion: string } }
    | { type: 'STATUS'; payload: { state: 'idle' | 'running' | 'paused' | 'faulted'; virtualTimeUs: number } }
    | { type: 'SNAPSHOT'; payload: { seq: number; virtualTimeUs: number; type: 'full' | 'delta'; changes: Record<string, any> } }
    | { type: 'EVENT'; payload: { virtualTimeUs: number; eventType: string; sourceId: string; data: any } }
    | { type: 'HEARTBEAT'; payload: { realTimeMs: number } };