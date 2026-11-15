import type { DisplayLibraryEvent, LibraryEvent, LibraryValue } from '@types';
import { findLibrary, findLibraryByClass } from '../libraries/search';
import type { LibraryAdapterId, LibraryDefinition } from '../libraries/types';

/* ======================================================================== */
/*  Adaptadores de librerías C++ curadas                                    */
/*                                                                          */
/*  El intérprete del sketch no conoce LCDs, WiFi ni MQTT: solo delega en   */
/*  un adaptador por librería. Cada adaptador mantiene su propio estado y   */
/*  emite eventos que el Worker traduce a estado visible (pantalla, MQTT).  */
/* ======================================================================== */

/** Declaración global detectada en el sketch: `Clase nombre(args);`. */
export interface LibraryObjectDeclaration {
    libraryId: string;
    className: string;
    name: string;
    args: string[];
}

/** Instancia viva de una librería dentro de un sketch compilado. */
export interface LibraryObjectRuntime {
    definition: LibraryDefinition;
    declaration: LibraryObjectDeclaration;
    state: unknown;
}

export interface LibraryRuntimeContext {
    libraryId: string;
    objectName: string;
    emit: (event: LibraryEvent) => void;
}

export class LibraryRuntimeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LibraryRuntimeError';
    }
}

interface LibraryAdapter {
    createState(args: readonly string[]): unknown;
    invoke(
        state: unknown,
        method: string,
        args: readonly LibraryValue[],
        context: LibraryRuntimeContext,
    ): LibraryValue;
    reset(state: unknown, context: LibraryRuntimeContext): void;
}

function numericArgument(raw: string | undefined): number | undefined {
    if (raw === undefined) return undefined;
    const text = raw.trim();
    if (text === '') return undefined;
    if (/^0x[0-9a-f]+$/i.test(text)) return parseInt(text, 16);
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
}

function toInt(value: LibraryValue | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
    if (typeof value === 'string') {
        const parsed = numericArgument(value);
        if (parsed !== undefined) return Math.floor(parsed);
    }
    return fallback;
}

function textOf(value: LibraryValue | undefined): string {
    return value === undefined ? '' : String(value);
}

/** Divide argumentos de constructor/llamada respetando comas dentro de strings. */
function splitTopLevelArguments(raw: string): string[] {
    const text = raw.trim();
    if (text === '') return [];

    const out: string[] = [];
    let current = '';
    let paren = 0;
    let quote: '"' | "'" | null = null;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quote) {
            current += char;
            if (char === '\\') {
                const next = text[i + 1];
                if (next !== undefined) {
                    current += next;
                    i++;
                }
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }
        if (char === '(') {
            paren++;
            current += char;
            continue;
        }
        if (char === ')') {
            paren--;
            current += char;
            continue;
        }
        if (char === ',' && paren === 0) {
            out.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }

    if (current.trim() !== '') out.push(current.trim());
    return out;
}

/** Quita directivas `#...` para que no se mezclen con el primer statement. */
function stripPreprocessorLines(source: string): string {
    return source
        .split(/\r?\n/)
        .map((line) => (/^[ \t\uFEFF]*#/.test(line) ? '' : line))
        .join('\n');
}

/**
 * Devuelve los statements de nivel superior (sin cuerpos de funciones).
 * Respeta strings y comentarios para no cortar por `;` o llaves internas.
 */
function topLevelStatements(source: string): string[] {
    const statements: string[] = [];
    let current = '';
    let depth = 0;
    let paren = 0;
    let quote: '"' | "'" | null = null;
    let lineComment = false;
    let blockComment = false;

    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        const next = source[i + 1];

        if (lineComment) {
            if (char === '\n') {
                lineComment = false;
                current += '\n';
            }
            continue;
        }
        if (blockComment) {
            if (char === '*' && next === '/') {
                blockComment = false;
                i++;
            }
            continue;
        }
        if (quote) {
            current += char;
            if (char === '\\') {
                if (next !== undefined) {
                    current += next;
                    i++;
                }
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }
        if (char === '/' && next === '/') {
            lineComment = true;
            current += ' ';
            i++;
            continue;
        }
        if (char === '/' && next === '*') {
            blockComment = true;
            current += ' ';
            i++;
            continue;
        }
        if (char === '(') {
            paren++;
            current += char;
            continue;
        }
        if (char === ')') {
            paren = Math.max(0, paren - 1);
            current += char;
            continue;
        }
        if (char === '{') {
            depth++;
            current += char;
            continue;
        }
        if (char === '}') {
            depth = Math.max(0, depth - 1);
            if (depth === 0) current = '';
            else current += char;
            continue;
        }
        if (char === ';' && depth === 0 && paren === 0) {
            const statement = current.trim();
            if (statement) statements.push(statement);
            current = '';
            continue;
        }
        current += char;
    }

    const tail = current.trim();
    if (tail) statements.push(tail);
    return statements;
}

/**
 * Detecta declaraciones globales de objetos de librerías conocidas.
 * Ignora `WiFiClient espClient;` (sin paréntesis) y las clases no curadas.
 */
export function parseLibraryObjects(source: string): LibraryObjectDeclaration[] {
    const objects: LibraryObjectDeclaration[] = [];
    const seen = new Set<string>();

    for (const statement of topLevelStatements(stripPreprocessorLines(source))) {
        const match = /^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(([\s\S]*)\)$/.exec(statement);
        if (!match) continue;

        const [, className, name, rawArgs] = match;
        const library = findLibraryByClass(className);
        if (!library || library.static) continue;
        if (seen.has(name)) continue;

        seen.add(name);
        objects.push({
            libraryId: library.id,
            className,
            name,
            args: splitTopLevelArguments(rawArgs),
        });
    }

    return objects;
}

/* ------------------------------------------------------------------------ */
/*  LCD I2C (LiquidCrystal_I2C)                                             */
/* ------------------------------------------------------------------------ */

interface LcdState {
    address: number;
    columns: number;
    rows: number;
    lines: string[];
    cursorColumn: number;
    cursorRow: number;
    backlight: boolean;
    displayOn: boolean;
}

function createLcdState(args: readonly string[]): LcdState {
    const columns = Math.max(1, Math.floor(numericArgument(args[1]) ?? 16));
    const rows = Math.max(1, Math.floor(numericArgument(args[2]) ?? 2));
    return {
        address: numericArgument(args[0]) ?? 0x27,
        columns,
        rows,
        lines: Array.from({ length: rows }, () => ''),
        cursorColumn: 0,
        cursorRow: 0,
        backlight: false,
        displayOn: false,
    };
}

function emitDisplay(state: LcdState, context: LibraryRuntimeContext): void {
    const event: DisplayLibraryEvent = {
        kind: 'display',
        library: context.libraryId,
        objectName: context.objectName,
        columns: state.columns,
        rows: state.rows,
        lines: [...state.lines],
        cursor: { column: state.cursorColumn, row: state.cursorRow },
        backlight: state.backlight,
        displayOn: state.displayOn,
    };
    context.emit(event);
}

function writeLcdText(
    state: LcdState,
    text: string,
    newline: boolean,
    context: LibraryRuntimeContext,
): void {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (const char of normalized) {
        if (char === '\n') {
            state.cursorColumn = 0;
            state.cursorRow = Math.min(state.rows - 1, state.cursorRow + 1);
            continue;
        }
        if (state.cursorRow < 0 || state.cursorRow >= state.rows) continue;

        const line = state.lines[state.cursorRow] ?? '';
        const chars = line.padEnd(state.columns, ' ').slice(0, state.columns).split('');
        if (state.cursorColumn >= 0 && state.cursorColumn < state.columns) {
            chars[state.cursorColumn] = char;
        }
        state.lines[state.cursorRow] = chars.join('').replace(/\s+$/, '');
        state.cursorColumn++;
        if (state.cursorColumn >= state.columns) {
            state.cursorColumn = 0;
            state.cursorRow = Math.min(state.rows - 1, state.cursorRow + 1);
        }
    }

    if (newline) {
        state.cursorColumn = 0;
        state.cursorRow = Math.min(state.rows - 1, state.cursorRow + 1);
    }
    emitDisplay(state, context);
}

function clearLcd(state: LcdState): void {
    state.lines = Array.from({ length: state.rows }, () => '');
    state.cursorColumn = 0;
    state.cursorRow = 0;
}

function scrollLcd(state: LcdState, direction: 'left' | 'right'): void {
    state.lines = state.lines.map((line) => {
        const padded = line.padEnd(state.columns, ' ').slice(0, state.columns);
        return direction === 'left' ? `${padded.slice(1)} ` : ` ${padded.slice(0, -1)}`;
    });
}

const lcdAdapter: LibraryAdapter = {
    createState: createLcdState,

    invoke(state, method, args, context) {
        const lcd = state as LcdState;
        switch (method) {
            case 'init':
                clearLcd(lcd);
                lcd.displayOn = true;
                emitDisplay(lcd, context);
                return 0;

            case 'begin': {
                lcd.columns = Math.max(1, toInt(args[0], lcd.columns));
                lcd.rows = Math.max(1, toInt(args[1], lcd.rows));
                clearLcd(lcd);
                lcd.displayOn = true;
                emitDisplay(lcd, context);
                return 0;
            }

            case 'clear':
                clearLcd(lcd);
                emitDisplay(lcd, context);
                return 0;

            case 'home':
                lcd.cursorColumn = 0;
                lcd.cursorRow = 0;
                emitDisplay(lcd, context);
                return 0;

            case 'setCursor':
                lcd.cursorColumn = Math.max(0, Math.min(lcd.columns - 1, toInt(args[0], 0)));
                lcd.cursorRow = Math.max(0, Math.min(lcd.rows - 1, toInt(args[1], 0)));
                emitDisplay(lcd, context);
                return 0;

            case 'print':
                writeLcdText(lcd, textOf(args[0]), false, context);
                return 0;

            case 'println':
                writeLcdText(lcd, textOf(args[0]), true, context);
                return 0;

            case 'write':
                writeLcdText(lcd, textOf(args[0]), false, context);
                return 0;

            case 'backlight':
                lcd.backlight = true;
                emitDisplay(lcd, context);
                return 0;

            case 'noBacklight':
                lcd.backlight = false;
                emitDisplay(lcd, context);
                return 0;

            case 'display':
                lcd.displayOn = true;
                emitDisplay(lcd, context);
                return 0;

            case 'noDisplay':
                lcd.displayOn = false;
                emitDisplay(lcd, context);
                return 0;

            case 'blink':
            case 'noBlink':
            case 'cursor':
            case 'noCursor':
            case 'createChar':
                // El estado del cursor no se dibuja en el SVG de la LCD del MVP.
                return 0;

            case 'scrollDisplayLeft':
                scrollLcd(lcd, 'left');
                emitDisplay(lcd, context);
                return 0;

            case 'scrollDisplayRight':
                scrollLcd(lcd, 'right');
                emitDisplay(lcd, context);
                return 0;

            default:
                throw new LibraryRuntimeError(
                    `Método no soportado: ${context.objectName}.${method}()`,
                );
        }
    },

    reset(state, context) {
        const lcd = state as LcdState;
        clearLcd(lcd);
        lcd.backlight = false;
        lcd.displayOn = false;
        emitDisplay(lcd, context);
    },
};

/* ------------------------------------------------------------------------ */
/*  WiFi simulado                                                           */
/* ------------------------------------------------------------------------ */

interface WifiState {
    connected: boolean;
    ip: string;
}

function createWifiState(): WifiState {
    return { connected: false, ip: '' };
}

const wifiAdapter: LibraryAdapter = {
    createState: createWifiState,

    invoke(state, method, _args, context) {
        const wifi = state as WifiState;
        switch (method) {
            case 'begin':
                wifi.connected = true;
                wifi.ip = '192.168.1.100';
                context.emit({ kind: 'wifi', connected: true, ip: wifi.ip });
                return 0;

            case 'status':
                return wifi.connected ? 3 : 0;

            case 'localIP':
                return wifi.ip;

            case 'disconnect':
                wifi.connected = false;
                wifi.ip = '';
                context.emit({ kind: 'wifi', connected: false });
                return 0;

            case 'mode':
                return 0;

            case 'macAddress':
                return '24:0A:C4:00:00:01';

            default:
                throw new LibraryRuntimeError(
                    `Método no soportado: ${context.objectName}.${method}()`,
                );
        }
    },

    reset(state, context) {
        const wifi = state as WifiState;
        wifi.connected = false;
        wifi.ip = '';
        context.emit({ kind: 'wifi', connected: false });
    },
};

/* ------------------------------------------------------------------------ */
/*  MQTT (PubSubClient)                                                     */
/* ------------------------------------------------------------------------ */

interface MqttState {
    connected: boolean;
    host: string;
    port: number;
    /** Nombre de la función callback registrada con `setCallback` (o undefined). */
    callbackName?: string;
    /** Tamaño de buffer pedido con `setBufferSize` (informativo; no limita el payload). */
    bufferSize?: number;
    keepAlive?: number;
    socketTimeout?: number;
    clientId?: string;
    cleanSession?: number;
    will?: { topic: string; payload: string };
}

function createMqttState(): MqttState {
    return { connected: false, host: '', port: 1883 };
}

const mqttAdapter: LibraryAdapter = {
    createState: createMqttState,

    invoke(state, method, args, context) {
        const mqtt = state as MqttState;
        switch (method) {
            case 'setServer':
                mqtt.host = textOf(args[0]);
                mqtt.port = toInt(args[1], mqtt.port);
                return 0;

            case 'setCallback': {
                // El argumento es el nombre de la función (el intérprete lo pasa
                // como string); validamos que exista en el sketch.
                const callbackName = textOf(args[0]).trim();
                if (!callbackName || !/^[A-Za-z_]\w*$/.test(callbackName)) {
                    throw new LibraryRuntimeError(
                        'PubSubClient.setCallback: se esperaba el nombre de una función (p. ej. `client.setCallback(callback)`)',
                    );
                }
                mqtt.callbackName = callbackName;
                return 0;
            }

            case 'setBufferSize':
                mqtt.bufferSize = toInt(args[0], 256);
                return mqtt.bufferSize;

            case 'setKeepAlive':
                mqtt.keepAlive = toInt(args[0], 15);
                return 0;

            case 'setSocketTimeout':
                mqtt.socketTimeout = toInt(args[0], 15);
                return 0;

            case 'setClientId':
                mqtt.clientId = textOf(args[0]);
                return 0;

            case 'setCleanSession':
                mqtt.cleanSession = toInt(args[0], 1) ? 1 : 0;
                return 0;

            case 'setWill':
                mqtt.will = { topic: textOf(args[0]), payload: textOf(args[1]) };
                return 0;

            case 'lastError':
                // 0 = sin errores reportados por el broker simulado.
                return 0;

            case 'connect':
                mqtt.connected = true;
                return 1;

            case 'connected':
                return mqtt.connected ? 1 : 0;

            case 'publish': {
                const topic = textOf(args[0]);
                const payload = textOf(args[1]);
                context.emit({
                    kind: 'mqtt-publish',
                    library: context.libraryId,
                    objectName: context.objectName,
                    topic,
                    payload,
                });
                return 1;
            }

            case 'subscribe':
            case 'unsubscribe': {
                const topic = textOf(args[0]).trim();
                // Tópico vacío: suscripción inválida, como en PubSubClient (devuelve 0).
                if (!topic) return 0;
                context.emit({
                    kind: 'mqtt-subscription',
                    action: method === 'subscribe' ? 'subscribe' : 'unsubscribe',
                    library: context.libraryId,
                    objectName: context.objectName,
                    topic,
                });
                return 1;
            }

            case 'loop':
                return 0;

            case 'disconnect':
                mqtt.connected = false;
                return 0;

            case 'state':
                return mqtt.connected ? 0 : -1;

            default:
                throw new LibraryRuntimeError(
                    `Método no soportado: ${context.objectName}.${method}()`,
                );
        }
    },

    reset(state) {
        const mqtt = state as MqttState;
        mqtt.connected = false;
        delete mqtt.callbackName;
        delete mqtt.bufferSize;
        delete mqtt.keepAlive;
        delete mqtt.socketTimeout;
        delete mqtt.clientId;
        delete mqtt.cleanSession;
        delete mqtt.will;
    },
};

const ADAPTERS: Record<LibraryAdapterId, LibraryAdapter> = {
    'lcd-i2c': lcdAdapter,
    wifi: wifiAdapter,
    mqtt: mqttAdapter,
};

/** Crea el runtime de una declaración global detectada en el sketch. */
/**
 * Nombre del callback MQTT registrado por un objeto PubSubClient (si hay).
 * Lo usa el Worker para saber a qué MCU y a qué función hay que entregar un
 * mensaje que llegó del broker.
 */
export function findMqttCallbackName(
    runtimes: Iterable<LibraryObjectRuntime>,
): string | null {
    for (const runtime of runtimes) {
        if (runtime.definition.id !== 'PubSubClient') continue;
        const name = (runtime.state as { callbackName?: unknown }).callbackName;
        if (typeof name === 'string' && name.length > 0) return name;
    }
    return null;
}

export function createLibraryRuntime(
    declaration: LibraryObjectDeclaration,
): LibraryObjectRuntime | null {
    const definition = findLibrary(declaration.libraryId);
    if (!definition) return null;
    return {
        definition,
        declaration,
        state: ADAPTERS[definition.adapter].createState(declaration.args),
    };
}

/** Crea el runtime de una librería de namespace (p. ej. `WiFi`). */
export function createStaticLibraryRuntime(
    definition: LibraryDefinition,
): LibraryObjectRuntime {
    return {
        definition,
        declaration: {
            libraryId: definition.id,
            className: definition.className ?? definition.id,
            name: definition.id,
            args: [],
        },
        state: ADAPTERS[definition.adapter].createState([]),
    };
}

export function invokeLibraryMethod(
    runtime: LibraryObjectRuntime,
    method: string,
    args: readonly LibraryValue[],
    emit: (event: LibraryEvent) => void,
): LibraryValue {
    const adapter = ADAPTERS[runtime.definition.adapter];
    return adapter.invoke(runtime.state, method, args, {
        libraryId: runtime.definition.id,
        objectName: runtime.declaration.name,
        emit,
    });
}

export function resetLibraryRuntime(
    runtime: LibraryObjectRuntime,
    emit: (event: LibraryEvent) => void,
): void {
    const adapter = ADAPTERS[runtime.definition.adapter];
    adapter.reset(runtime.state, {
        libraryId: runtime.definition.id,
        objectName: runtime.declaration.name,
        emit,
    });
}
