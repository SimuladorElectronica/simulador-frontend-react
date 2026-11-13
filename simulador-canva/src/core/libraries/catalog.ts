import type { LibraryDefinition } from './types';

/**
 * Catálogo cerrado de librerías curadas del MVP.
 *
 * Solo se listan librerías que el runtime del Worker puede ejecutar. Agregar
 * una entrada acá NO alcanza: también hay que implementar su adaptador en
 * `core/runtime/libraryRuntime.ts` y, si aplica, vincularlo a un manifiesto
 * mediante `ComponentManifest.libraries`.
 *
 * El orden del array es el orden inicial del modal.
 */
export const LIBRARY_CATALOG: readonly LibraryDefinition[] = [
    {
        id: 'LiquidCrystal_I2C',
        displayName: 'LCD 16x2 con I2C (LiquidCrystal_I2C)',
        description:
            'Controla pantallas LCD 16x2 con backpack I2C. Permite inicializar la pantalla, ubicar el cursor y escribir texto en dos líneas.',
        category: 'Pantallas',
        headers: ['Wire.h', 'LiquidCrystal_I2C.h'],
        className: 'LiquidCrystal_I2C',
        keywords: ['lcd', 'display', 'pantalla', 'i2c', '1602', 'liquid crystal', 'texto'],
        adapter: 'lcd-i2c',
        compatibleManifests: ['core/lcd16x2_i2c@1'],
        constructorSignature: 'LiquidCrystal_I2C(uint8_t address, uint8_t columns, uint8_t rows)',
        declarationTemplate: 'LiquidCrystal_I2C lcd(0x27, 16, 2);',
        methods: [
            {
                name: 'init',
                signature: 'init()',
                documentation: 'Inicializa la pantalla LCD y la deja lista para escribir.',
                returns: 'void',
            },
            {
                name: 'begin',
                signature: 'begin(columns, rows)',
                documentation: 'Inicializa la pantalla indicando columnas y filas.',
                returns: 'void',
            },
            {
                name: 'clear',
                signature: 'clear()',
                documentation: 'Borra todo el contenido de la pantalla.',
                returns: 'void',
            },
            {
                name: 'home',
                signature: 'home()',
                documentation: 'Lleva el cursor a la posición inicial (columna 0, fila 0).',
                returns: 'void',
            },
            {
                name: 'setCursor',
                signature: 'setCursor(column, row)',
                documentation: 'Ubica el cursor en la columna y fila indicadas (base 0).',
                returns: 'void',
            },
            {
                name: 'print',
                signature: 'print(value)',
                documentation: 'Escribe texto o un número en la posición actual del cursor.',
                returns: 'void',
            },
            {
                name: 'println',
                signature: 'println(value)',
                documentation: 'Escribe texto o un número y avanza a la fila siguiente.',
                returns: 'void',
            },
            {
                name: 'write',
                signature: 'write(value)',
                documentation: 'Escribe un carácter en la posición actual del cursor.',
                returns: 'void',
            },
            {
                name: 'backlight',
                signature: 'backlight()',
                documentation: 'Enciende la retroiluminación de la pantalla.',
                returns: 'void',
            },
            {
                name: 'noBacklight',
                signature: 'noBacklight()',
                documentation: 'Apaga la retroiluminación de la pantalla.',
                returns: 'void',
            },
            {
                name: 'display',
                signature: 'display()',
                documentation: 'Muestra el contenido de la pantalla.',
                returns: 'void',
            },
            {
                name: 'noDisplay',
                signature: 'noDisplay()',
                documentation: 'Oculta el contenido de la pantalla.',
                returns: 'void',
            },
            {
                name: 'blink',
                signature: 'blink()',
                documentation: 'Activa el cursor parpadeante.',
                returns: 'void',
            },
            {
                name: 'noBlink',
                signature: 'noBlink()',
                documentation: 'Desactiva el cursor parpadeante.',
                returns: 'void',
            },
            {
                name: 'cursor',
                signature: 'cursor()',
                documentation: 'Muestra el cursor.',
                returns: 'void',
            },
            {
                name: 'noCursor',
                signature: 'noCursor()',
                documentation: 'Oculta el cursor.',
                returns: 'void',
            },
            {
                name: 'scrollDisplayLeft',
                signature: 'scrollDisplayLeft()',
                documentation: 'Desplaza el contenido de la pantalla hacia la izquierda.',
                returns: 'void',
            },
            {
                name: 'scrollDisplayRight',
                signature: 'scrollDisplayRight()',
                documentation: 'Desplaza el contenido de la pantalla hacia la derecha.',
                returns: 'void',
            },
            {
                name: 'createChar',
                signature: 'createChar(slot, charMap)',
                documentation:
                    'Registra un carácter personalizado en una ranura (se acepta en el sketch, pero el diseño del carácter no se dibuja en el MVP).',
                returns: 'void',
            },
        ],
        example: `#include <Wire.h>
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
  lcd.print(millis() / 1000);
  delay(1000);
}`,
    },
    {
        id: 'WiFi',
        displayName: 'WiFi (ESP32)',
        description:
            'Conecta el ESP32 simulado a una red WiFi. El estado de conexión y la IP son simulados, pero permiten practicar la estructura típica de un sketch IoT.',
        category: 'Conectividad',
        headers: ['WiFi.h'],
        static: true,
        keywords: ['wifi', 'red', 'internet', 'conexion', 'ip', 'esp32', 'ssid'],
        adapter: 'wifi',
        methods: [
            {
                name: 'begin',
                signature: 'begin(ssid, password)',
                documentation: 'Inicia la conexión a la red WiFi indicada.',
                returns: 'void',
            },
            {
                name: 'status',
                signature: 'status()',
                documentation:
                    'Devuelve el estado de la conexión (WL_CONNECTED = 3 en la simulación).',
                returns: 'number',
            },
            {
                name: 'localIP',
                signature: 'localIP()',
                documentation: 'Devuelve la IP asignada al ESP32 simulado.',
                returns: 'string',
            },
            {
                name: 'disconnect',
                signature: 'disconnect()',
                documentation: 'Desconecta el ESP32 de la red WiFi simulada.',
                returns: 'void',
            },
            {
                name: 'mode',
                signature: 'mode(mode)',
                documentation: 'Configura el modo WiFi (WIFI_STA por defecto).',
                returns: 'void',
            },
            {
                name: 'macAddress',
                signature: 'macAddress()',
                documentation: 'Devuelve la MAC simulada del ESP32.',
                returns: 'string',
            },
        ],
        example: `#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.begin("MiRed", "MiClave");

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi conectado");
    Serial.println(WiFi.localIP());
  }
}

void loop() {
  delay(1000);
}`,
    },
    {
        id: 'PubSubClient',
        displayName: 'MQTT (PubSubClient)',
        description:
            'Publica y recibe mensajes MQTT desde el ESP32 simulado. Las publicaciones alimentan el monitor MQTT del simulador.',
        category: 'Conectividad',
        headers: ['WiFi.h', 'PubSubClient.h'],
        className: 'PubSubClient',
        keywords: ['mqtt', 'pubsub', 'broker', 'iot', 'telemetria', 'topic', 'publish', 'subscribe'],
        adapter: 'mqtt',
        compatibleManifests: ['core/esp32@1'],
        constructorSignature: 'PubSubClient(Client& client)',
        declarationTemplate: 'PubSubClient client(espClient);',
        methods: [
            {
                name: 'setServer',
                signature: 'setServer(host, port)',
                documentation: 'Configura el host y puerto del broker MQTT simulado.',
                returns: 'void',
            },
            {
                name: 'connect',
                signature: 'connect(clientId)',
                documentation: 'Conecta el cliente MQTT con el identificador indicado.',
                returns: 'number',
            },
            {
                name: 'connected',
                signature: 'connected()',
                documentation: 'Indica si el cliente MQTT está conectado.',
                returns: 'number',
            },
            {
                name: 'publish',
                signature: 'publish(topic, payload)',
                documentation:
                    'Publica un mensaje en un tópico. En el simulador se refleja en el monitor MQTT.',
                returns: 'number',
            },
            {
                name: 'subscribe',
                signature: 'subscribe(topic)',
                documentation: 'Se suscribe a un tópico MQTT.',
                returns: 'number',
            },
            {
                name: 'unsubscribe',
                signature: 'unsubscribe(topic)',
                documentation: 'Cancela la suscripción a un tópico MQTT.',
                returns: 'number',
            },
            {
                name: 'loop',
                signature: 'loop()',
                documentation: 'Procesa mensajes pendientes del cliente MQTT.',
                returns: 'number',
            },
            {
                name: 'disconnect',
                signature: 'disconnect()',
                documentation: 'Desconecta el cliente MQTT.',
                returns: 'void',
            },
            {
                name: 'state',
                signature: 'state()',
                documentation: 'Devuelve el estado interno del cliente MQTT.',
                returns: 'number',
            },
        ],
        example: `#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  WiFi.begin("MiRed", "MiClave");
  client.setServer("broker.local", 1883);
  client.connect("esp32-sim");
}

void loop() {
  client.publish("esp32/telemetria", "temperatura=25");
  delay(2000);
}`,
    },
];
