import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { Esp32Manifest, Lcd16x2Manifest, LedManifest } from '@core/manifests';

// Stub de `self` para cargar el worker en jsdom/vitest.
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Msg = any;

const posted: Msg[] = [];
let messageHandler: ((e: { data: Msg }) => void) | null = null;

const selfStub = {
    postMessage: (msg: Msg) => {
        posted.push(msg);
    },
    addEventListener: (_type: string, handler: (e: { data: Msg }) => void) => {
        messageHandler = handler;
    },
};
vi.stubGlobal('self', selfStub);

await import('../worker/circuitWorker');

function send(data: Msg) {
    messageHandler?.({ data });
}

function eventsOfType(type: string) {
    return posted.filter((message) => message.type === type);
}

function eventsNamed(name: string) {
    return eventsOfType('EVENT').filter((event) => event.payload.eventType === name);
}

function lastComponentState(componentId: string) {
    const snapshots = eventsOfType('SNAPSHOT').filter(
        (snapshot) => snapshot.payload.changes[componentId] !== undefined,
    );
    return snapshots.length > 0
        ? (snapshots[snapshots.length - 1].payload.changes[componentId] as Record<string, unknown>)
        : undefined;
}

function lcdProjection() {
    return {
        components: [
            { id: 'esp', type: 'core/esp32@1', params: {} },
            { id: 'lcd1', type: 'core/lcd16x2_i2c@1', params: {} },
        ],
        wires: [
            {
                id: 'w1',
                from: { componentId: 'esp', pinId: '3v3' },
                to: { componentId: 'lcd1', pinId: 'vcc' },
            },
            {
                id: 'w2',
                from: { componentId: 'esp', pinId: 'gnd1' },
                to: { componentId: 'lcd1', pinId: 'gnd' },
            },
            {
                id: 'w3',
                from: { componentId: 'esp', pinId: 'gpio21' },
                to: { componentId: 'lcd1', pinId: 'sda' },
            },
            {
                id: 'w4',
                from: { componentId: 'esp', pinId: 'gpio22' },
                to: { componentId: 'lcd1', pinId: 'scl' },
            },
        ],
        programs: [],
    };
}

function loadAndCompile(projection: ReturnType<typeof lcdProjection>, source: string) {
    send({ type: 'HELLO', payload: { version: '1.0.0' }, requestId: '1' });
    send({
        type: 'LOAD_CIRCUIT',
        payload: {
            projection,
            manifests: [Esp32Manifest, Lcd16x2Manifest, LedManifest],
        },
    });
    send({ type: 'SET_PROGRAM', payload: { mcuComponentId: 'esp', source } });
}

describe('circuitWorker: LCD y MQTT con librerías curadas', () => {
    beforeEach(() => {
        posted.length = 0;
        ManifestRegistry.init();
    });

    it('el sketch LCD escribe line1/line2 en el snapshot del componente', () => {
        const SKETCH = `
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Hola ESP32");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("t=");
  lcd.print(String(millis() / 1000));
  delay(1000);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);

        // STEP evita depender de timers reales: dos pasos virtuales de 1 s.
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 1_000_000 } });
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 1_000_000 } });

        const lcdState = lastComponentState('lcd1');
        expect(lcdState).toBeDefined();
        expect(lcdState?.line1).toBe('Hola ESP32');
        expect(lcdState?.line2).toBe('t=1');

        // Sin fault: las llamadas de la librería están soportadas.
        expect(eventsNamed('PROGRAM_FAULT')).toHaveLength(0);
    });

    it('client.publish emite MQTT_PUBLISH con tópico, payload y tiempo virtual', () => {
        const SKETCH = `
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  WiFi.begin("MiRed", "MiClave");
  client.setServer("broker.local", 1883);
  client.connect("esp32-sim");
  if (WiFi.status() == WL_CONNECTED && client.connected()) {
    Serial.println(WiFi.localIP());
  }
}

void loop() {
  client.publish("esp32/telemetria", "temperatura=25");
  delay(2000);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 1_000_000 } });

        expect(eventsNamed('PROGRAM_FAULT').map((event) => event.payload.data)).toEqual([]);
        const published = eventsNamed('MQTT_PUBLISH');
        expect(published).toHaveLength(1);
        expect(published[0].payload.sourceId).toBe('esp');
        expect(published[0].payload.virtualTimeUs).toBe(0);
        expect(published[0].payload.data).toMatchObject({
            topic: 'esp32/telemetria',
            payload: 'temperatura=25',
        });

        const wifi = eventsNamed('WIFI_STATE');
        expect(wifi.length).toBeGreaterThan(0);
        expect(wifi[0].payload.data).toMatchObject({ connected: true });

        const serial = eventsNamed('SERIAL')
            .map((event) => String(event.payload.data))
            .join('\n');
        expect(serial).toContain('192.168.1.100');
    });

    it('client.subscribe emite MQTT_SUBSCRIBE con el tópico del sketch', () => {
        const SKETCH = `
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  WiFi.begin("MiRed", "MiClave");
  client.setServer("broker.local", 1883);
  client.connect("esp32-sim");
  client.subscribe("esp32/led");
}

void loop() {
  delay(1000);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });

        expect(eventsNamed('PROGRAM_FAULT').map((event) => event.payload.data)).toEqual([]);
        const subscribed = eventsNamed('MQTT_SUBSCRIBE');
        expect(subscribed).toHaveLength(1);
        expect(subscribed[0].payload.sourceId).toBe('esp');
        expect(subscribed[0].payload.data).toMatchObject({ topic: 'esp32/led' });
    });

    it('un header desconocido es solo una advertencia (el sketch corre igual)', () => {
        const SKETCH = `
#include <LibreriaInexistente.h>

void setup() {
  Serial.begin(115200);
  Serial.println("ok");
}

void loop() {
  delay(1000);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });

        expect(eventsNamed('PROGRAM_ERROR')).toHaveLength(0);
        expect(eventsNamed('PROGRAM_FAULT')).toHaveLength(0);
        const serial = eventsNamed('SERIAL');
        expect(serial.some((event) => String(event.payload.data).includes('ok'))).toBe(true);
    });

    it('MQTT_MESSAGE entrega el mensaje al callback del sketch (topic, payload, length)', () => {
        const SKETCH = `
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.println("CB topic=" + topic + " payload=" + payload + " len=" + String(length));
}

void setup() {
  Serial.begin(115200);
  Serial.println("Subscriber boot");
  WiFi.begin("MiRed", "MiClave");
  client.setServer("broker.local", 1883);
  client.connect();
  client.setCallback(mqttCallback);
  client.subscribe("esp32/led");
}

void loop() {
  client.loop();
  delay(100);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });
        send({
            type: 'MQTT_MESSAGE',
            payload: { topic: 'esp32/led', payload: 'ON' },
        });
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });

        expect(eventsNamed('PROGRAM_FAULT').map((event) => event.payload.data)).toEqual([]);
        const serial = eventsNamed('SERIAL')
            .map((event) => String(event.payload.data))
            .join('\n');
        expect(serial).toContain('Subscriber boot');
        expect(serial).toContain('CB topic=esp32/led payload=ON len=2');
    });

    it('un MQTT_MESSAGE encolado durante un delay() se entrega al despertar (no fuerza el wake)', () => {
        const SKETCH = `
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.println("CB:" + payload);
}

void setup() {
  Serial.begin(115200);
  WiFi.begin("MiRed", "MiClave");
  client.setServer("broker.local", 1883);
  client.connect();
  client.setCallback(mqttCallback);
  client.subscribe("esp32/led");
}

void loop() {
  client.loop();
  delay(1000);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);
        // t=0: setup + una vuelta de loop + delay(1000) → despierta en t=1_000_000us.
        // STEP avanza el tiempo DESPUÉS de correr los MCU, así que esto deja t=900_000.
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 900_000 } });
        send({ type: 'MQTT_MESSAGE', payload: { topic: 'esp32/led', payload: 'PRIMER' } });
        // En t=900_000 aún no llegó el wake (1_000_000): el sketch no corre y no se entrega
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });
        let serial = eventsNamed('SERIAL')
            .map((event) => String(event.payload.data))
            .join('\n');
        expect(serial).not.toContain('CB:PRIMER');
        // Al alcanzar el wake, el mensaje se entrega en el resume (antes que loop)
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });
        serial = eventsNamed('SERIAL')
            .map((event) => String(event.payload.data))
            .join('\n');
        expect(serial).toContain('CB:PRIMER');
        expect(eventsNamed('PROGRAM_FAULT')).toHaveLength(0);
    });

    it('un MQTT_MESSAGE sin setCallback se descarta sin fault', () => {
        const SKETCH = `
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  Serial.println("boot");
  WiFi.begin("MiRed", "MiClave");
  client.setServer("broker.local", 1883);
  client.connect();
  client.subscribe("esp32/led");
}

void loop() {
  client.loop();
  delay(100);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });
        send({ type: 'MQTT_MESSAGE', payload: { topic: 'esp32/led', payload: 'ON' } });
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });

        expect(eventsNamed('PROGRAM_FAULT')).toHaveLength(0);
        const serial = eventsNamed('SERIAL')
            .map((event) => String(event.payload.data))
            .join('\n');
        expect(serial).toContain('boot');
        expect(serial).not.toContain('ON');
    });

    it('setCallback con nombre que no existe en el sketch: fault MQTT_CALLBACK_MISSING al recibir', () => {
        const SKETCH = `
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  WiFi.begin("MiRed", "MiClave");
  client.setServer("broker.local", 1883);
  client.connect();
  client.setCallback("funcionFantasma");
  client.subscribe("esp32/led");
}

void loop() {
  client.loop();
  delay(100);
}
`;

        loadAndCompile(lcdProjection(), SKETCH);
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });
        send({ type: 'MQTT_MESSAGE', payload: { topic: 'esp32/led', payload: 'ON' } });
        send({ type: 'CONTROL', payload: { action: 'STEP', stepUs: 100_000 } });

        const faults = eventsNamed('PROGRAM_FAULT');
        expect(faults.length).toBeGreaterThan(0);
        expect(faults[0].payload.data).toMatchObject({ code: 'MQTT_CALLBACK_MISSING' });
    });
});
