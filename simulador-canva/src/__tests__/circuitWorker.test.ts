import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { LedManifest, Esp32Manifest } from '@core/manifests';

// Stub de `self` para cargar el worker en jsdom/vitest
const posted: any[] = [];
let messageHandler: ((e: { data: any }) => void) | null = null;

const selfStub = {
    postMessage: (msg: any) => posted.push(msg),
    addEventListener: (_type: string, handler: (e: { data: any }) => void) => {
        messageHandler = handler;
    },
};
vi.stubGlobal('self', selfStub);

// Carga el worker (registra su handler de mensajes)
await import('../worker/circuitWorker');

function send(data: any) {
    messageHandler?.({ data });
}

function eventsOfType(type: string) {
    return posted.filter((m) => m.type === type);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('circuitWorker: blink end-to-end (protocolo + reloj + solver)', () => {
    beforeEach(() => {
        posted.length = 0;
        ManifestRegistry.init();
    });

    it('el LED parpadea, el reloj avanza durante delay() y no hay fault', async () => {
        const projection = {
            components: [
                { id: 'esp', type: 'core/esp32@1', params: {} },
                { id: 'led1', type: 'core/led@1', params: {} },
            ],
            wires: [
                { id: 'w1', from: { componentId: 'esp', pinId: 'gpio2' }, to: { componentId: 'led1', pinId: 'anode' } },
                { id: 'w2', from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp', pinId: 'gnd1' } },
            ],
            programs: [],
        };
        const manifests = [Esp32Manifest, LedManifest];
        const BLINK = `
const int LED_PIN = 2;
void setup() { pinMode(LED_PIN, OUTPUT); Serial.begin(115200); Serial.println("inicio"); }
void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`;

        send({ type: 'HELLO', payload: { version: '1.0.0' }, requestId: '1' });
        send({ type: 'LOAD_CIRCUIT', payload: { projection, manifests } });
        send({ type: 'SET_PROGRAM', payload: { mcuComponentId: 'esp', source: BLINK } });
        send({ type: 'CONTROL', payload: { action: 'START', stepUs: 10000 } });

        // Dejar correr ~1.4s reales (stepUs=10ms virtuales por tick de ~10ms reales
        // en el worker: delayMs = stepUs/1000 = 10ms -> ~140 ticks = 1.4s virtuales)
        await sleep(1600);

        const statuses = eventsOfType('STATUS');
        const lastStatus = statuses[statuses.length - 1];
        // El reloj NO debe estar detenido (el tiempo virtual viaja en SNAPSHOT)
        expect(lastStatus.payload.state).toBe('running');
        const snaps = eventsOfType('SNAPSHOT');
        expect(snaps.length).toBeGreaterThan(0);
        expect(snaps[snaps.length - 1].payload.virtualTimeUs).toBeGreaterThan(500000);

        const solverResults = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SOLVER_RESULT');
        expect(solverResults.length).toBeGreaterThan(0);
        const lastSolver = solverResults[solverResults.length - 1];
        expect(lastSolver.payload.data.converged).toBe(true);

        const serials = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SERIAL');
        expect(serials.some((s) => String(s.payload.data).includes('inicio'))).toBe(true);

        const snapshots = eventsOfType('SNAPSHOT');
        const ledStates = snapshots
            .flatMap((s) => Object.entries(s.payload.changes))
            .filter(([id]) => id === 'led1:d1')
            .map(([, v]: any) => v?.conducting);
        // Debe haber alternado ON y OFF
        expect(ledStates).toContain(true);
        expect(ledStates).toContain(false);

        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
    }, 10000);
});
