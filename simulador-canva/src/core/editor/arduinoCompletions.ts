/**
 * Autocompletado Arduino Core (ESP32) para el editor Monaco.
 *
 * Fuente de verdad: las funciones soportadas por `ArduinoCore`
 * (`core/runtime/arduinoCore.ts`) y por `cppSubsetBackend`
 * (`core/runtime/cppSubsetBackend.ts`). Si se agrega una función al
 * core, debe agregarse aquí para que el autocompletado la ofrezca.
 *
 * Este módulo es datos puros (sin dependencia de Monaco) para poder
 * testearlo sin descargar el runtime del editor.
 */

/** Id de lenguaje exclusivo para sketches: solo C++, nunca JS/TS. */
export const ARDUINO_LANGUAGE_ID = 'cpp' as const;

export type ArduinoCompletionKind = 'Function' | 'Constant' | 'Snippet';

export interface ArduinoCompletion {
  /** Etiqueta visible en el autocompletado */
  label: string;
  kind: ArduinoCompletionKind;
  /** Resumen corto (detail en Monaco) */
  detail: string;
  /** Documentación (hover / detalle extendido) */
  documentation: string;
  /** Texto que se inserta al aceptar la sugerencia */
  insertText: string;
}

/**
 * Funciones y constantes del Arduino Core soportadas por el subset.
 * El orden es el de presentación en el menú de autocompletado.
 */
export const ARDUINO_COMPLETIONS: readonly ArduinoCompletion[] = [
  {
    label: 'setup',
    kind: 'Snippet',
    detail: 'void setup() — se ejecuta una vez al arrancar',
    documentation:
      'Punto de entrada obligatorio del sketch. Configura pines y el puerto serie aquí.',
    insertText: 'void setup() {\n\t$0\n}',
  },
  {
    label: 'loop',
    kind: 'Snippet',
    detail: 'void loop() — se repite indefinidamente',
    documentation:
      'Punto de entrada obligatorio del sketch. Todo el código que corre en bucle va aquí.',
    insertText: 'void loop() {\n\t$0\n}',
  },
  {
    label: 'pinMode',
    kind: 'Function',
    detail: 'pinMode(pin, mode)',
    documentation:
      'Configura un GPIO como INPUT, OUTPUT, INPUT_PULLUP o INPUT_PULLDOWN.',
    insertText: 'pinMode(${1:pin}, ${2|INPUT,OUTPUT,INPUT_PULLUP,INPUT_PULLDOWN|})$0',
  },
  {
    label: 'digitalWrite',
    kind: 'Function',
    detail: 'digitalWrite(pin, value)',
    documentation: 'Escribe HIGH o LOW en un pin configurado como OUTPUT.',
    insertText: 'digitalWrite(${1:pin}, ${2|HIGH,LOW|})$0',
  },
  {
    label: 'digitalRead',
    kind: 'Function',
    detail: 'digitalRead(pin) → HIGH | LOW',
    documentation: 'Lee el nivel digital de un GPIO (aplica umbrales con histéresis).',
    insertText: 'digitalRead(${1:pin})$0',
  },
  {
    label: 'analogWrite',
    kind: 'Function',
    detail: 'analogWrite(pin, duty 0-255)',
    documentation: 'Salida PWM de 8 bits sobre un pin con capacidad PWM.',
    insertText: 'analogWrite(${1:pin}, ${2:128})$0',
  },
  {
    label: 'analogRead',
    kind: 'Function',
    detail: 'analogRead(pin) → 0-4095',
    documentation: 'Lectura ADC de 12 bits sobre un pin con capacidad ADC.',
    insertText: 'analogRead(${1:pin})$0',
  },
  {
    label: 'delay',
    kind: 'Function',
    detail: 'delay(ms)',
    documentation: 'Suspende la ejecución virtual durante los ms indicados.',
    insertText: 'delay(${1:500})$0',
  },
  {
    label: 'delayMicroseconds',
    kind: 'Function',
    detail: 'delayMicroseconds(us)',
    documentation: 'Suspende la ejecución virtual durante los µs indicados.',
    insertText: 'delayMicroseconds(${1:1000})$0',
  },
  {
    label: 'millis',
    kind: 'Function',
    detail: 'millis() → ms desde el arranque (virtual)',
    documentation: 'Tiempo virtual en milisegundos desde el inicio de la simulación.',
    insertText: 'millis()$0',
  },
  {
    label: 'micros',
    kind: 'Function',
    detail: 'micros() → µs desde el arranque (virtual)',
    documentation: 'Tiempo virtual en microsegundos desde el inicio de la simulación.',
    insertText: 'micros()$0',
  },
  {
    label: 'Serial.begin',
    kind: 'Function',
    detail: 'Serial.begin(baud)',
    documentation: 'Inicializa el puerto serie UART (típico: 115200).',
    insertText: 'Serial.begin(${1|9600,115200,230400,460800,921600|})$0',
  },
  {
    label: 'Serial.print',
    kind: 'Function',
    detail: 'Serial.print(text)',
    documentation: 'Escribe texto al monitor serie sin salto de línea.',
    insertText: 'Serial.print("$0")',
  },
  {
    label: 'Serial.println',
    kind: 'Function',
    detail: 'Serial.println(text)',
    documentation: 'Escribe texto al monitor serie con salto de línea.',
    insertText: 'Serial.println("$0")',
  },
  {
    label: 'HIGH',
    kind: 'Constant',
    detail: 'HIGH = 1',
    documentation: 'Nivel lógico alto.',
    insertText: 'HIGH',
  },
  {
    label: 'LOW',
    kind: 'Constant',
    detail: 'LOW = 0',
    documentation: 'Nivel lógico bajo.',
    insertText: 'LOW',
  },
  {
    label: 'INPUT',
    kind: 'Constant',
    detail: 'INPUT = 0',
    documentation: 'Modo de pin: entrada digital.',
    insertText: 'INPUT',
  },
  {
    label: 'OUTPUT',
    kind: 'Constant',
    detail: 'OUTPUT = 1',
    documentation: 'Modo de pin: salida digital.',
    insertText: 'OUTPUT',
  },
  {
    label: 'INPUT_PULLUP',
    kind: 'Constant',
    detail: 'INPUT_PULLUP = 2',
    documentation: 'Modo de pin: entrada con pull-up interno.',
    insertText: 'INPUT_PULLUP',
  },
  {
    label: 'INPUT_PULLDOWN',
    kind: 'Constant',
    detail: 'INPUT_PULLDOWN = 3',
    documentation: 'Modo de pin: entrada con pull-down interno.',
    insertText: 'INPUT_PULLDOWN',
  },
] as const;

/** Etiquetas planas (útil para asserts / tests). */
export const ARDUINO_COMPLETION_LABELS: readonly string[] = ARDUINO_COMPLETIONS.map(
  (c) => c.label,
);

/** Busca una sugerencia por etiqueta exacta. */
export function findArduinoCompletion(label: string): ArduinoCompletion | undefined {
  return ARDUINO_COMPLETIONS.find((c) => c.label === label);
}

/** ¿La etiqueta es una función Arduino Core soportada? */
export function isArduinoFunction(label: string): boolean {
  return findArduinoCompletion(label)?.kind === 'Function';
}

/**
 * Velocidades UART típicas del ESP32. La consola serie expone estas
 * como opciones; el simulador es virtual (no hay baud real), pero la
 * interfaz debe dejar claro a qué velocidad se interpreta la salida.
 */
export const UART_BAUD_RATES: readonly number[] = [
  9600, 115200, 230400, 460800, 921600,
] as const;

export const DEFAULT_UART_BAUD = 115200 as const;
