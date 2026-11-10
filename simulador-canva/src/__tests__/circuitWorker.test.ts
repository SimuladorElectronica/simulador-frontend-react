import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { LedManifest, Esp32Manifest } from '@core/manifests';
import type { ComponentManifest } from '@types';

// Stub de `self` para cargar el worker en jsdom/vitest.
// Los mensajes del protocolo se inspeccionan como datos opacos: `Msg` existe
// solo para no repetir casts en las aserciones de los tests.
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Msg = any;

const posted: Msg[] = [];
/** Instante wall-clock (ms) en que cada mensaje de `posted` se emitió, en el mismo orden. */
const postedAt: number[] = [];
let messageHandler: ((e: { data: Msg }) => void) | null = null;

const selfStub = {
    postMessage: (msg: Msg) => {
        posted.push(msg);
        postedAt.push(Date.now());
    },
    addEventListener: (_type: string, handler: (e: { data: Msg }) => void) => {
        messageHandler = handler;
    },
};
vi.stubGlobal('self', selfStub);

// Carga el worker (registra su handler de mensajes)
await import('../worker/circuitWorker');

function send(data: Msg) {
    messageHandler?.({ data });
}

function eventsOfType(type: string) {
    return posted.filter((m) => m.type === type);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('circuitWorker: blink end-to-end (protocolo + reloj + solver)', () => {
    beforeEach(() => {
        posted.length = 0;
        postedAt.length = 0;
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
            .map(([, v]: [string, Msg]) => v?.conducting);
        // Debe haber alternado ON y OFF
        expect(ledStates).toContain(true);
        expect(ledStates).toContain(false);

        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
    }, 10000);

    it('un sketch guardado en el documento (projection.programs) se compila y ejecuta', async () => {
        const SKETCH = `
void setup() {
  pinMode(2, OUTPUT);
  Serial.begin(115200);
  Serial.println("desde el documento");
}
void loop() {
  digitalWrite(2, HIGH);
  delay(200);
}
`;
        const projection = {
            components: [
                { id: 'esp', type: 'core/esp32@1', params: {} },
                { id: 'led1', type: 'core/led@1', params: {} },
            ],
            wires: [
                { id: 'w1', from: { componentId: 'esp', pinId: 'gpio2' }, to: { componentId: 'led1', pinId: 'anode' } },
                { id: 'w2', from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp', pinId: 'gnd1' } },
            ],
            programs: [
                {
                    mcuComponentId: 'esp',
                    language: 'cpp-subset',
                    languageVersion: '1.0.0',
                    source: SKETCH,
                },
            ],
        };

        send({ type: 'LOAD_CIRCUIT', payload: { projection, manifests: [Esp32Manifest, LedManifest] } });
        send({ type: 'CONTROL', payload: { action: 'START', stepUs: 10000 } });

        await sleep(400);

        // El sketch corre y emite por el monitor serie
        const serials = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SERIAL');
        expect(serials.some((s) => String(s.payload.data).includes('desde el documento'))).toBe(true);

        // El solver se ejecuta con los GPIO del core y converge
        const solverResults = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SOLVER_RESULT');
        expect(solverResults.length).toBeGreaterThan(0);
        expect(solverResults[solverResults.length - 1].payload.data.converged).toBe(true);

        // El LED se enciende (pinMode(OUTPUT) + digitalWrite(HIGH))
        const ledOn = eventsOfType('SNAPSHOT').some((s) => s.payload.changes['led1:d1']?.conducting === true);
        expect(ledOn).toBe(true);

        // Sin pines fantasma: un GPIO sin conexión (y sin código que lo mande)
        // no debe tener tensión (regresión: antes quedaba en 1.65 V)
        const floating = eventsOfType('SNAPSHOT')
            .flatMap((s) => Object.entries(s.payload.changes))
            .filter(([id]) => id === 'esp:gpio_1');
        expect(floating.length).toBeGreaterThan(0);
        expect(floating.every(([, v]) => (v as { voltage: number }).voltage < 0.01)).toBe(true);

        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
    }, 10000);
});

describe('circuitWorker: criterios de aceptación (quemado, bucle infinito, brownout)', () => {
    beforeEach(() => {
        posted.length = 0;
        postedAt.length = 0;
        ManifestRegistry.init();
    });

    function espLedProjection() {
        return {
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
    }

    function loadAndStart(manifests: ComponentManifest[], source: string) {
        send({ type: 'HELLO', payload: { version: '1.0.0' }, requestId: '1' });
        send({ type: 'LOAD_CIRCUIT', payload: { projection: espLedProjection(), manifests } });
        send({ type: 'SET_PROGRAM', payload: { mcuComponentId: 'esp', source } });
        send({ type: 'CONTROL', payload: { action: 'START', stepUs: 10000 } });
    }

    it('COMPONENT_BURNED: GPIO2 en HIGH sostenido quema el LED tras 1.5 s virtuales y emite en <100 ms', async () => {
        const SKETCH = `
void setup() { pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); delay(1000); }
`;
        loadAndStart([Esp32Manifest, LedManifest], SKETCH);

        // stepUs=10ms virtuales por tick de ~10ms reales: hacen falta >150 ticks
        await sleep(2800);

        const burned = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'COMPONENT_BURNED');
        expect(burned.length).toBe(1);
        expect(burned[0].payload.virtualTimeUs).toBeLessThanOrEqual(1_500_000 + 20_000);
        expect(burned[0].payload.data).toMatchObject({ componentId: 'led1', elementId: 'led1:d1', action: 'destroy' });

        // Criterio de aceptación: el evento llega dentro de los 100 ms tras el
        // primer mensaje que ya alcanza 1.5 s de tiempo virtual.
        const burnedIdx = posted.indexOf(burned[0]);
        const firstPastIdx = posted.findIndex(
            (m) => typeof m.payload?.virtualTimeUs === 'number' && m.payload.virtualTimeUs >= 1_500_000,
        );
        expect(firstPastIdx).toBeGreaterThanOrEqual(0);
        expect(postedAt[burnedIdx] - postedAt[firstPastIdx]).toBeLessThanOrEqual(100);

        // El LED queda destruido en el netlist: circuito abierto, sin corriente.
        const destroyed = eventsOfType('SNAPSHOT')
            .flatMap((s) => Object.entries(s.payload.changes))
            .filter(([id]) => id === 'led1:d1')
            .map(([, v]) => v as { destroyed?: boolean; current?: number });
        expect(destroyed.some((v) => v?.destroyed === true && v?.current === 0)).toBe(true);

        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
    }, 15000);

    it('bucle infinito en loop() no degrada la UI: snapshots acotados y PAUSE responde', async () => {
        // Sin delay(): el backend preempta cada MAX_STEPS y el reloj sigue avanzando.
        const SKETCH = `
void setup() { pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); }
`;
        loadAndStart([Esp32Manifest, LedManifest], SKETCH);

        await sleep(700);
        const snapshotCount = eventsOfType('SNAPSHOT').length;
        // Sin inundar el hilo principal: solo cambios + latido cada 250 ms virtuales.
        expect(snapshotCount).toBeLessThan(15);

        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
        const statuses = eventsOfType('STATUS');
        const lastStatus = statuses[statuses.length - 1];
        expect(lastStatus.payload.state).toBe('paused');
        expect(lastStatus.payload.virtualTimeUs).toBeGreaterThan(100_000);
    }, 10000);

    it('BROWNOUT_RESET: riel bajo el umbral dispara el evento y reinicia el MCU (setup vuelve a correr)', async () => {
        // La fuente ideal no se hunde sola, así que se fuerza un monitor sintético
        // con un umbral por encima del riel: cubre el camino evento→reset del worker.
        const esp32WithBrownout: ComponentManifest = {
            ...Esp32Manifest,
            monitors: [
                {
                    element: 'vcc_3v3',
                    quantity: 'voltage',
                    comparison: 'below',
                    limit: 3.4,
                    duration: 50_000,
                    event: 'BROWNOUT_RESET',
                    action: 'reset',
                    scope: 'component',
                },
            ],
        };
        const SKETCH = `
void setup() { pinMode(2, OUTPUT); Serial.begin(115200); Serial.println("boot"); }
void loop() { digitalWrite(2, HIGH); delay(100); }
`;
        loadAndStart([esp32WithBrownout, LedManifest], SKETCH);

        await sleep(1200);

        const brownouts = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'BROWNOUT_RESET');
        expect(brownouts.length).toBe(1);
        expect(brownouts[0].payload.sourceId).toBe('esp');
        expect(brownouts[0].payload.virtualTimeUs).toBeLessThanOrEqual(50_000 + 20_000);

        // El reset hace que setup() corra otra vez: "boot" se imprime ≥2 veces.
        const boots = eventsOfType('EVENT').filter(
            (e) => e.payload.eventType === 'SERIAL' && String(e.payload.data).includes('boot'),
        );
        expect(boots.length).toBeGreaterThanOrEqual(2);

        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
    }, 10000);

    it('Serial.println en loop() sin delay() no atora la simulación (loteo acotado)', async () => {
        const SKETCH = `
int contador = 0;
void setup() { pinMode(2, OUTPUT); Serial.begin(115200); }
void loop() {
  contador = contador + 1;
  digitalWrite(2, HIGH);
  Serial.println(contador);
}
`;
        loadAndStart([Esp32Manifest, LedManifest], SKETCH);

        await sleep(700);

        const serials = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SERIAL');
        // La salida llega, pero en lotes: sin loteo serían ~666 eventos por tick.
        expect(serials.length).toBeGreaterThan(0);
        expect(serials.length).toBeLessThan(150);
        expect(serials.some((s) => /\d/.test(String(s.payload.data)))).toBe(true);
        // Cada lote está acotado (100 líneas + aviso de omisión)
        for (const s of serials) {
            expect(String(s.payload.data).split('\n').length).toBeLessThanOrEqual(101);
        }
        // El exceso se descarta indicando cuántas líneas se omitieron
        expect(serials.some((s) => String(s.payload.data).includes('omitidas'))).toBe(true);

        // La simulación sigue viva: el reloj avanza y PAUSE responde.
        expect(eventsOfType('SNAPSHOT').length).toBeLessThan(15);
        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
        const statuses = eventsOfType('STATUS');
        const lastStatus = statuses[statuses.length - 1];
        expect(lastStatus.payload.state).toBe('paused');
        expect(lastStatus.payload.virtualTimeUs).toBeGreaterThan(100_000);
    }, 10000);

    it('cargar un programa NO arranca la simulación por sí solo', async () => {
        const SKETCH = `
void setup() { pinMode(2, OUTPUT); Serial.begin(115200); Serial.println("hola"); }
void loop() { digitalWrite(2, HIGH); delay(100); }
`;
        send({ type: 'HELLO', payload: { version: '1.0.0' }, requestId: '1' });
        send({ type: 'LOAD_CIRCUIT', payload: { projection: espLedProjection(), manifests: [Esp32Manifest, LedManifest] } });
        send({ type: 'SET_PROGRAM', payload: { mcuComponentId: 'esp', source: SKETCH } });

        await sleep(300);

        // Sin CONTROL START: ningún estado 'running', setup() no corrió y t=0.
        const statuses = eventsOfType('STATUS');
        expect(statuses.some((s) => s.payload.state === 'running')).toBe(false);
        expect(statuses[statuses.length - 1].payload.state).toBe('idle');
        expect(eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SERIAL')).toHaveLength(0);
        const snaps = eventsOfType('SNAPSHOT');
        expect(snaps[snaps.length - 1].payload.virtualTimeUs).toBe(0);
    }, 10000);

    it('RESET limpia el monitor serie y vuelve a empezar el contador desde 0', async () => {
        const SKETCH = `
int contador = 0;
void setup() { pinMode(2, OUTPUT); Serial.begin(115200); }
void loop() {
  contador = contador + 1;
  digitalWrite(2, HIGH);
  Serial.println(contador);
  delay(50);
}
`;
        loadAndStart([Esp32Manifest, LedManifest], SKETCH);

        await sleep(500);
        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });

        const numbersFrom = (startIdx: number): number[] =>
            posted
                .slice(startIdx)
                .filter((m) => m.type === 'EVENT' && m.payload.eventType === 'SERIAL')
                .flatMap((m) => String(m.payload.data).split('\n'))
                .map((s) => s.trim())
                .filter((s) => /^-?\d+$/.test(s))
                .map(Number);

        const beforeReset = numbersFrom(0);
        expect(beforeReset.length).toBeGreaterThan(0);
        expect(beforeReset[beforeReset.length - 1]).toBeGreaterThan(1);

        const resetCountBefore = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SERIAL_RESET').length;
        const resetIdx = posted.length;

        send({ type: 'CONTROL', payload: { action: 'RESET' } });
        // El worker avisa a la UI que limpie el monitor serie
        expect(eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SERIAL_RESET').length)
            .toBeGreaterThan(resetCountBefore);

        send({ type: 'CONTROL', payload: { action: 'START', stepUs: 10000 } });
        await sleep(500);
        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });

        // El sketch volvió a setup() con los globales en su valor inicial:
        // el primer contador impreso es 1 (contador = 0 + 1)
        const afterReset = numbersFrom(resetIdx);
        expect(afterReset.length).toBeGreaterThan(0);
        expect(afterReset[0]).toBe(1);

        const statuses = eventsOfType('STATUS');
        expect(statuses[statuses.length - 1].payload.state).toBe('paused');
    }, 10000);
});

describe('circuitWorker: varios MCU en simultáneo', () => {
    beforeEach(() => {
        posted.length = 0;
        postedAt.length = 0;
        ManifestRegistry.init();
    });

    it('dos ESP32 con delays distintos convergen y el reloj sigue avanzando', async () => {
        // Placas independientes (cada una con su LED y su tierra): es el caso
        // que antes dejaba flotando la segunda placa y frenaba la simulación.
        const projection = {
            components: [
                { id: 'esp1', type: 'core/esp32@1', params: {} },
                { id: 'led1', type: 'core/led@1', params: {} },
                { id: 'esp2', type: 'core/esp32@1', params: {} },
                { id: 'led2', type: 'core/led@1', params: {} },
            ],
            wires: [
                { id: 'w1', from: { componentId: 'esp1', pinId: 'gpio2' }, to: { componentId: 'led1', pinId: 'anode' } },
                { id: 'w2', from: { componentId: 'led1', pinId: 'cathode' }, to: { componentId: 'esp1', pinId: 'gnd1' } },
                { id: 'w3', from: { componentId: 'esp2', pinId: 'gpio2' }, to: { componentId: 'led2', pinId: 'anode' } },
                { id: 'w4', from: { componentId: 'led2', pinId: 'cathode' }, to: { componentId: 'esp2', pinId: 'gnd1' } },
            ],
            programs: [
                {
                    mcuComponentId: 'esp1',
                    language: 'cpp-subset',
                    languageVersion: '1.0.0',
                    source: `
void setup() { pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); delay(500); digitalWrite(2, LOW); delay(500); }
`,
                },
                {
                    mcuComponentId: 'esp2',
                    language: 'cpp-subset',
                    languageVersion: '1.0.0',
                    source: `
void setup() { pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); delay(1000); digitalWrite(2, LOW); delay(1000); }
`,
                },
            ],
        };

        send({ type: 'HELLO', payload: { version: '1.0.0' }, requestId: '1' });
        send({ type: 'LOAD_CIRCUIT', payload: { projection, manifests: [Esp32Manifest, LedManifest] } });
        send({ type: 'CONTROL', payload: { action: 'START', stepUs: 10000 } });

        await sleep(1600);

        const statuses = eventsOfType('STATUS');
        expect(statuses[statuses.length - 1].payload.state).toBe('running');

        const snaps = eventsOfType('SNAPSHOT');
        expect(snaps[snaps.length - 1].payload.virtualTimeUs).toBeGreaterThan(500_000);

        const solverResults = eventsOfType('EVENT').filter((e) => e.payload.eventType === 'SOLVER_RESULT');
        expect(solverResults.length).toBeGreaterThan(0);
        expect(solverResults[solverResults.length - 1].payload.data.converged).toBe(true);
        expect(
            solverResults.some((e) => Array.isArray(e.payload.data.diagnostics) && e.payload.data.diagnostics.length > 0),
        ).toBe(false);

        // Las dos placas ejecutan su sketch y la UI ve ambos LEDs
        const ledStates = eventsOfType('SNAPSHOT')
            .flatMap((s) => Object.entries(s.payload.changes))
            .filter(([id]) => id === 'led1:d1' || id === 'led2:d1')
            .map(([id, v]: [string, Msg]) => ({ id, conducting: (v as { conducting?: boolean })?.conducting }));
        expect(ledStates.some((s) => s.id === 'led1:d1' && s.conducting === true)).toBe(true);
        expect(ledStates.some((s) => s.id === 'led2:d1' && s.conducting === true)).toBe(true);

        send({ type: 'CONTROL', payload: { action: 'PAUSE' } });
    }, 10000);
});
