import { describe, it, expect } from 'vitest';
import type { DisplayLibraryEvent, LibraryEvent, MqttPublishLibraryEvent, MqttSubscriptionLibraryEvent } from '@types';
import {
    createLibraryRuntime,
    createStaticLibraryRuntime,
    invokeLibraryMethod,
    LibraryRuntimeError,
    parseLibraryObjects,
    resetLibraryRuntime,
    findMqttCallbackName,
} from '@core/runtime/libraryRuntime';
import { findLibrary } from '@core/libraries/search';

function collector() {
    const events: LibraryEvent[] = [];
    return { events, emit: (event: LibraryEvent) => events.push(event) };
}

describe('parseLibraryObjects', () => {
    it('detecta objetos globales de librerías curadas e ignora clases no curadas', () => {
        const source = `
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClient espClient;
PubSubClient client(espClient);
// LCD falso(0x27, 16, 2);

void setup() {
  LiquidCrystal_I2C local(0x27, 20, 4);
}
void loop() {}
`;

        const objects = parseLibraryObjects(source);
        expect(objects).toHaveLength(2);
        expect(objects[0]).toMatchObject({
            libraryId: 'LiquidCrystal_I2C',
            className: 'LiquidCrystal_I2C',
            name: 'lcd',
            args: ['0x27', '16', '2'],
        });
        expect(objects[1]).toMatchObject({
            libraryId: 'PubSubClient',
            className: 'PubSubClient',
            name: 'client',
            args: ['espClient'],
        });
    });

    it('no confunde llamadas sueltas de funciones con declaraciones de objetos', () => {
        const source = `
void setup() {
  lcd.init();
}
`;
        expect(parseLibraryObjects(source)).toEqual([]);
    });
});

describe('adaptador LCD I2C', () => {
    function createLcd() {
        const runtime = createLibraryRuntime({
            libraryId: 'LiquidCrystal_I2C',
            className: 'LiquidCrystal_I2C',
            name: 'lcd',
            args: ['0x27', '16', '2'],
        });
        expect(runtime).not.toBeNull();
        return runtime!;
    }

    it('init/backlight/setCursor/print emiten el contenido de las dos líneas', () => {
        const { events, emit } = collector();
        const lcd = createLcd();

        invokeLibraryMethod(lcd, 'init', [], emit);
        invokeLibraryMethod(lcd, 'backlight', [], emit);
        invokeLibraryMethod(lcd, 'setCursor', [0, 0], emit);
        invokeLibraryMethod(lcd, 'print', ['Hola ESP32'], emit);
        invokeLibraryMethod(lcd, 'setCursor', [0, 1], emit);
        invokeLibraryMethod(lcd, 'print', ['t='], emit);
        invokeLibraryMethod(lcd, 'print', [3], emit);

        const last = events[events.length - 1] as DisplayLibraryEvent;
        expect(last.kind).toBe('display');
        expect(last.objectName).toBe('lcd');
        expect(last.lines).toEqual(['Hola ESP32', 't=3']);
        expect(last.backlight).toBe(true);
        expect(last.displayOn).toBe(true);
    });

    it('respeta el ancho de la pantalla y el salto de línea de println', () => {
        const { events, emit } = collector();
        const lcd = createLcd();

        invokeLibraryMethod(lcd, 'init', [], emit);
        invokeLibraryMethod(lcd, 'print', ['12345678901234567890'], emit);

        const wrapped = events[events.length - 1] as DisplayLibraryEvent;
        expect(wrapped.lines).toEqual(['1234567890123456', '7890']);

        invokeLibraryMethod(lcd, 'clear', [], emit);
        invokeLibraryMethod(lcd, 'println', ['uno'], emit);
        const afterClear = events[events.length - 1] as DisplayLibraryEvent;
        expect(afterClear.lines).toEqual(['uno', '']);
        expect(afterClear.cursor).toEqual({ column: 0, row: 1 });
    });

    it('clear y reset apagan el contenido y la retroiluminación', () => {
        const { events, emit } = collector();
        const lcd = createLcd();

        invokeLibraryMethod(lcd, 'init', [], emit);
        invokeLibraryMethod(lcd, 'backlight', [], emit);
        invokeLibraryMethod(lcd, 'print', ['hola'], emit);

        resetLibraryRuntime(lcd, emit);
        const reset = events[events.length - 1] as DisplayLibraryEvent;
        expect(reset.lines).toEqual(['', '']);
        expect(reset.backlight).toBe(false);
        expect(reset.displayOn).toBe(false);
    });

    it('un método desconocido falla con LibraryRuntimeError', () => {
        const { emit } = collector();
        const lcd = createLcd();
        expect(() => invokeLibraryMethod(lcd, 'metodoInexistente', [], emit)).toThrow(
            LibraryRuntimeError,
        );
    });
});

describe('adaptador WiFi', () => {
    it('simula la conexión, el estado y la IP', () => {
        const { events, emit } = collector();
        const definition = findLibrary('WiFi');
        expect(definition).toBeDefined();
        const wifi = createStaticLibraryRuntime(definition!);

        expect(invokeLibraryMethod(wifi, 'status', [], emit)).toBe(0);
        expect(invokeLibraryMethod(wifi, 'begin', ['MiRed', 'MiClave'], emit)).toBe(0);
        expect(invokeLibraryMethod(wifi, 'status', [], emit)).toBe(3);
        expect(invokeLibraryMethod(wifi, 'localIP', [], emit)).toBe('192.168.1.100');
        expect(invokeLibraryMethod(wifi, 'disconnect', [], emit)).toBe(0);
        expect(invokeLibraryMethod(wifi, 'status', [], emit)).toBe(0);

        const wifiEvent = events.find((event) => event.kind === 'wifi');
        expect(wifiEvent).toMatchObject({ kind: 'wifi', connected: true });
    });
});

describe('adaptador MQTT (PubSubClient)', () => {
    function createMqtt() {
        const runtime = createLibraryRuntime({
            libraryId: 'PubSubClient',
            className: 'PubSubClient',
            name: 'client',
            args: ['espClient'],
        });
        expect(runtime).not.toBeNull();
        return runtime!;
    }

    it('connect/connected/publish emiten el mensaje para el monitor MQTT', () => {
        const { events, emit } = collector();
        const client = createMqtt();

        expect(invokeLibraryMethod(client, 'connected', [], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'connect', ['esp32-sim'], emit)).toBe(1);
        expect(invokeLibraryMethod(client, 'connected', [], emit)).toBe(1);
        expect(
            invokeLibraryMethod(
                client,
                'publish',
                ['esp32/telemetria', 'temperatura=25'],
                emit,
            ),
        ).toBe(1);

        const published = events[events.length - 1] as MqttPublishLibraryEvent;
        expect(published).toMatchObject({
            kind: 'mqtt-publish',
            objectName: 'client',
            topic: 'esp32/telemetria',
            payload: 'temperatura=25',
        });

        expect(invokeLibraryMethod(client, 'disconnect', [], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'connected', [], emit)).toBe(0);
    });

    it('subscribe/unsubscribe emiten MQTT_SUBSCRIBE para el proxy real', () => {
        const { events, emit } = collector();
        const client = createMqtt();

        expect(invokeLibraryMethod(client, 'subscribe', ['esp32/led'], emit)).toBe(1);
        const subscribed = events[events.length - 1] as MqttSubscriptionLibraryEvent;
        expect(subscribed).toMatchObject({
            kind: 'mqtt-subscription',
            action: 'subscribe',
            objectName: 'client',
            topic: 'esp32/led',
        });

        expect(invokeLibraryMethod(client, 'unsubscribe', ['esp32/led'], emit)).toBe(1);
        const unsubscribed = events[events.length - 1] as MqttSubscriptionLibraryEvent;
        expect(unsubscribed).toMatchObject({
            kind: 'mqtt-subscription',
            action: 'unsubscribe',
            topic: 'esp32/led',
        });

        // Tópico vacío: suscripción inválida (0), no se emite nada.
        const before = events.length;
        expect(invokeLibraryMethod(client, 'subscribe', [''], emit)).toBe(0);
        expect(events).toHaveLength(before);
    });

    it('setCallback valida y guarda el nombre de la función', () => {
        const { emit } = collector();
        const client = createMqtt();

        expect(invokeLibraryMethod(client, 'setCallback', ['mqttCallback'], emit)).toBe(0);
        expect(findMqttCallbackName([client])).toBe('mqttCallback');

        // Un nombre con caracteres inválidos es un error de uso, no un silencio
        expect(() => invokeLibraryMethod(client, 'setCallback', ['no es válido!'], emit)).toThrow(
            LibraryRuntimeError,
        );
        expect(() => invokeLibraryMethod(client, 'setCallback', [''], emit)).toThrow(
            LibraryRuntimeError,
        );
    });

    it('los setters simples retornan valores razonables y no fallan', () => {
        const { events, emit } = collector();
        const client = createMqtt();

        expect(invokeLibraryMethod(client, 'setBufferSize', [512], emit)).toBe(512);
        expect(invokeLibraryMethod(client, 'setBufferSize', [0], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'setKeepAlive', [30], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'setSocketTimeout', [5], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'setClientId', ['esp32-sim'], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'setCleanSession', [1], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'setCleanSession', [0], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'setWill', ['esp32/lastwill', 'offline'], emit)).toBe(0);
        expect(invokeLibraryMethod(client, 'lastError', [], emit)).toBe(0);
        // state(): -1 = MQTT_DISCONNECTED, 0 = MQTT_CONNECTED (igual que PubSubClient)
        expect(invokeLibraryMethod(client, 'state', [], emit)).toBe(-1);
        expect(invokeLibraryMethod(client, 'connect', [], emit)).toBe(1);
        expect(invokeLibraryMethod(client, 'state', [], emit)).toBe(0);
        expect(events).toHaveLength(0); // nada de esto emite eventos
    });

    it('resetLibraryRuntime descarta callbackName y estado de configuración', () => {
        const { emit } = collector();
        const client = createMqtt();

        invokeLibraryMethod(client, 'setCallback', ['cb'], emit);
        invokeLibraryMethod(client, 'setBufferSize', [512], emit);
        invokeLibraryMethod(client, 'setWill', ['t', 'm'], emit);

        resetLibraryRuntime(client, emit);
        expect(findMqttCallbackName([client])).toBeNull();
        expect(client.state).toMatchObject({ connected: false });
        expect(client.state).not.toHaveProperty('callbackName');
        expect(client.state).not.toHaveProperty('bufferSize');
        expect(client.state).not.toHaveProperty('will');
    });
});
