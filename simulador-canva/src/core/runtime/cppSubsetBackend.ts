import type {
    CodeDiagnostic,
    ExecutionResult,
    HostInterface,
    LanguageBackend,
    LibraryEvent,
    LibraryValue,
} from '@types';
import { SleepSignal, ArduinoError } from './arduinoCore';
import { ARDUINO } from './esp32Profile';
import { sameHeader } from '../libraries/headers';
import { listIncludes } from '../libraries/injectInclude';
import { findLibrary, findLibraryByHeader } from '../libraries/search';
import {
    findMqttCallbackName,
    createLibraryRuntime,
    createStaticLibraryRuntime,
    invokeLibraryMethod,
    LibraryRuntimeError,
    parseLibraryObjects,
    resetLibraryRuntime,
} from './libraryRuntime';
import type { LibraryObjectDeclaration, LibraryObjectRuntime } from './libraryRuntime';

/**
 * LanguageBackend mínimo para el subset C++ de Arduino:
 *  - funciones `void setup()` y `void loop()`
 *  - variables globales `int/const int` con inicializador
 *  - statements: asignación, llamada a función, if/else, return, bloque
 *  - expresiones: números, strings, identificadores, llamadas, binarias,
 *    comparaciones y paréntesis
 *  - constantes: HIGH, LOW, INPUT, OUTPUT, INPUT_PULLUP, INPUT_PULLDOWN
 *  - librerías curadas: objetos globales (`LiquidCrystal_I2C lcd(...)`) y
 *    métodos (`lcd.print(...)`) delegados a `libraryRuntime`
 *
 * La ejecución se suspende por presupuesto de steps (preempted) o por
 * delay()/delayMicroseconds() (sleeping, vía SleepSignal del ArduinoCore).
 */

interface UserFunction {
    /** Parámetros posicionales (solo nombres: `void cb(char* topic, byte* payload, unsigned int length)` → [topic, payload, length]). */
    params: string[];
    /** Statements del cuerpo de la función. */
    body: string[];
}

interface Program {
    source: string;
    globals: Array<{ name: string; value: number }>;
    setupBody: string[];
    loopBody: string[];
    libraryObjects: LibraryObjectDeclaration[];
    /** Funciones definidas por el sketch (p. ej. el callback de PubSubClient). */
    userFunctions: Map<string, UserFunction>;
}

interface Instance {
    program: Program;
    host: HostInterface;
    vars: Map<string, LibraryValue>;
    setupDone: boolean;
    /** Paso de instrucciones ejecutado en el resume actual */
    steps: number;
    /** Contador de programa: permite retomar a mitad de loop() tras un delay */
    pcBody: string[];
    pcIndex: number;
    pcInLoop: boolean;
    /** Objetos de librerías declarados en el sketch, por nombre de variable. */
    libraryObjects: Map<string, LibraryObjectRuntime>;
    /** Namespaces/objetos estáticos creados bajo demanda (p. ej. `WiFi`). */
    staticLibraries: Map<string, LibraryObjectRuntime>;
    /** Mensajes MQTT que llegaron del broker y esperan el callback del sketch. */
    pendingMqttMessages: Array<{ topic: string; payload: string }>;
}

const MAX_STEPS_PER_RESUME = 2000;

/**
 * De `char* topic, byte* payload, unsigned int length` devuelve
 * [topic, payload, length] (solo nombres; los tipos se ignoran).
 */
function parseParams(raw: string): string[] {
    return raw
        .split(',')
        .map((part) => part.replace(/\/\*.*?\*\//g, ' ').trim())
        .map((part) => {
            if (!part) return '';
            const token = (part.split(/\s+/).pop() ?? '')
                .replace(/^[*&]+/, '')
                .replace(/\[[^\]]*\]$/, '');
            return /^[A-Za-z_]\w*$/.test(token) ? token : '';
        })
        .filter((name) => name !== '');
}

function diag(
    code: string,
    message: string,
    line = 1,
    severity: 'error' | 'warning' = 'error',
): CodeDiagnostic {
    return { severity, code, message, line, column: 1 };
}

/**
 * Extrae el cuerpo { ... } de `<ret> <name>(<params>)` ignorando llaves en
 * strings/comentarios. `params` se ignora por completo (el valor es el cuerpo).
 */
function extractFunction(source: string, name: string): string | null {
    const re = new RegExp(`(?:void|int|bool|long|String)\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
    const match = re.exec(source);
    if (!match) return null;

    let index = match.index + match[0].length;
    let depth = 1;
    let body = '';
    let quote: '"' | "'" | null = null;
    let lineComment = false;
    let blockComment = false;

    while (index < source.length && depth > 0) {
        const char = source[index];
        const next = source[index + 1];

        if (lineComment) {
            body += char;
            if (char === '\n') lineComment = false;
            index++;
            continue;
        }
        if (blockComment) {
            body += char;
            if (char === '*' && next === '/') {
                body += next;
                index += 2;
                blockComment = false;
                continue;
            }
            index++;
            continue;
        }
        if (quote) {
            body += char;
            if (char === '\\') {
                if (next !== undefined) {
                    body += next;
                    index += 2;
                    continue;
                }
            } else if (char === quote) {
                quote = null;
            }
            index++;
            continue;
        }
        if (char === '/' && next === '/') {
            lineComment = true;
            body += char;
            index++;
            continue;
        }
        if (char === '/' && next === '*') {
            blockComment = true;
            body += char;
            index++;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            body += char;
            index++;
            continue;
        }
        if (char === '{') depth++;
        else if (char === '}') {
            depth--;
            if (depth === 0) break;
        }
        body += char;
        index++;
    }

    return depth === 0 ? body : null;
}

/** Divide un cuerpo en statements terminados en ';' o bloques if/else. */
function splitStatements(body: string): string[] {
    const out: string[] = [];
    let current = '';
    let depth = 0;
    let paren = 0;
    let quote: '"' | "'" | null = null;
    let lineComment = false;
    let blockComment = false;

    for (let index = 0; index < body.length; index++) {
        const char = body[index];
        const next = body[index + 1];

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
                index++;
            }
            continue;
        }
        if (quote) {
            current += char;
            if (char === '\\') {
                if (next !== undefined) {
                    current += next;
                    index++;
                }
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === '/' && next === '/') {
            lineComment = true;
            index++;
            continue;
        }
        if (char === '/' && next === '*') {
            blockComment = true;
            index++;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }

        current += char;
        if (char === '(') paren++;
        else if (char === ')') paren--;
        else if (char === '{') depth++;
        else if (char === '}') {
            depth--;
            if (depth === 0 && paren === 0) {
                // Si sigue un `else`, el statement if aún no termina
                const rest = body.slice(index + 1).trimStart();
                if (!rest.startsWith('else')) {
                    out.push(current.trim());
                    current = '';
                }
            }
        } else if (char === ';' && depth === 0 && paren === 0) {
            out.push(current.trim());
            current = '';
        }
    }

    if (current.trim()) out.push(current.trim());
    return out.filter((statement) => statement.length > 0);
}

class Fault extends Error {}

function lineOf(source: string, offset: number): number {
    return source.slice(0, offset).split('\n').length;
}

/** ¿Toda la expresión está envuelta en un único par de paréntesis? */
function isWrappedInParentheses(expr: string): boolean {
    if (!expr.startsWith('(') || !expr.endsWith(')')) return false;

    let depth = 0;
    let quote: '"' | "'" | null = null;

    for (let index = 0; index < expr.length; index++) {
        const char = expr[index];
        if (quote) {
            if (char === '\\') index++;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '(') depth++;
        else if (char === ')') {
            depth--;
            if (depth === 0 && index !== expr.length - 1) return false;
        }
    }

    return depth === 0;
}

function isTruthy(value: LibraryValue): boolean {
    return typeof value === 'number' ? value !== 0 : value !== '';
}

/**
 * Devuelve el índice del delimitador de cierre que empareja al de apertura.
 * Respeta strings y delimitadores anidados (p. ej. `if (WiFi.status() == 3)`).
 */
function findMatchingDelimiter(
    source: string,
    openIndex: number,
    open: string,
    close: string,
): number {
    let depth = 0;
    let quote: '"' | "'" | null = null;

    for (let index = openIndex; index < source.length; index++) {
        const char = source[index];
        if (quote) {
            if (char === '\\') index++;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === open) {
            depth++;
            continue;
        }
        if (char === close) {
            depth--;
            if (depth === 0) return index;
        }
    }

    return -1;
}

function numberArg(value: LibraryValue | undefined, context: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    throw new Fault(`Argumento numérico inválido en ${context}: ${String(value)}`);
}

const STRING_LITERAL_RE = /^"((?:\\.|[^"\\])*)"$/;

/**
 * Busca un operador a nivel superior (fuera de paréntesis y strings).
 * `last` sirve para operadores asociativos a izquierda (`a - b - c`).
 */
function findTopLevelOperator(
    expr: string,
    operators: readonly string[],
    mode: 'first' | 'last' = 'first',
): { index: number; operator: string } | null {
    let depth = 0;
    let quote: '"' | "'" | null = null;
    let found: { index: number; operator: string } | null = null;

    for (let index = 0; index < expr.length; index++) {
        const char = expr[index];

        if (quote) {
            if (char === '\\') index++;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '(') {
            depth++;
            continue;
        }
        if (char === ')') {
            depth = Math.max(0, depth - 1);
            continue;
        }
        if (depth !== 0) continue;

        let matched: string | null = null;
        for (const operator of operators) {
            if (expr.startsWith(operator, index)) {
                matched = operator;
                break;
            }
        }
        if (!matched) continue;
        // Un operador al principio o al final es unario/incompleto.
        if (index === 0 || index + matched.length >= expr.length) continue;

        found = { index, operator: matched };
        if (mode === 'first') return found;
        index += matched.length - 1;
    }

    return found;
}

function parseStringLiteral(expr: string): string | null {
    const match = STRING_LITERAL_RE.exec(expr);
    if (!match) return null;

    let out = '';
    const inner = match[1];
    for (let index = 0; index < inner.length; index++) {
        const char = inner[index];
        if (char !== '\\') {
            out += char;
            continue;
        }
        const next = inner[++index];
        switch (next) {
            case 'n':
                out += '\n';
                break;
            case 'r':
                out += '\r';
                break;
            case 't':
                out += '\t';
                break;
            case '"':
                out += '"';
                break;
            case '\\':
                out += '\\';
                break;
            default:
                out += next ?? '';
                break;
        }
    }
    return out;
}

export const cppSubsetBackend: LanguageBackend = {
    compile(source: string, platformProfile: string) {
        const diagnostics: CodeDiagnostic[] = [];
        if (platformProfile !== 'esp32@1') {
            diagnostics.push(
                diag('UNSUPPORTED_PLATFORM', `Plataforma no soportada: ${platformProfile}`),
            );
        }
        const setupBody = extractFunction(source, 'setup');
        const loopBody = extractFunction(source, 'loop');
        if (setupBody === null) {
            diagnostics.push(diag('MISSING_SETUP', 'No se encontró `void setup()`'));
        }
        if (loopBody === null) {
            diagnostics.push(diag('MISSING_LOOP', 'No se encontró `void loop()`'));
        }

        // Llaves balanceadas (chequeo rápido)
        let depth = 0;
        for (const char of source) {
            if (char === '{') depth++;
            else if (char === '}') depth--;
            if (depth < 0) break;
        }
        if (depth !== 0) {
            diagnostics.push(diag('UNBALANCED_BRACES', 'Llaves desbalanceadas en el sketch'));
        }

        // Headers de librerías: los desconocidos no bloquean el sketch, solo avisan.
        const includes = listIncludes(source);
        for (const include of includes) {
            if (!findLibraryByHeader(include.header)) {
                diagnostics.push(
                    diag(
                        'LIBRARY_UNKNOWN',
                        `Header de librería no soportado: <${include.header}> (se ignora)`,
                        include.line + 1,
                        'warning',
                    ),
                );
            }
        }

        const libraryObjects = parseLibraryObjects(source);

        // Funciones propias del sketch (p. ej. el callback de PubSubClient)
        const userFunctions = new Map<string, UserFunction>();
        for (const match of source.matchAll(
            /(?:void|int|bool|long|String)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g,
        )) {
            const name = match[1];
            if (name === 'setup' || name === 'loop') continue;
            const body = extractFunction(source, name);
            if (body === null) continue;
            userFunctions.set(name, {
                params: parseParams(match[2]),
                body: splitStatements(body),
            });
        }
        for (const object of libraryObjects) {
            const definition = findLibrary(object.libraryId);
            if (!definition) continue;
            const hasAnyHeader = definition.headers.some((header) =>
                includes.some((include) => sameHeader(include.header, header)),
            );
            if (!hasAnyHeader) {
                diagnostics.push(
                    diag(
                        'LIBRARY_INCLUDE_MISSING',
                        `La librería ${definition.displayName} se usa sin #include`,
                        1,
                        'warning',
                    ),
                );
            }
        }

        if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
            return { diagnostics };
        }

        const globals: Array<{ name: string; value: number }> = [];
        const globalRe = /(?:const\s+)?int\s+([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*;/g;
        let globalMatch: RegExpExecArray | null;
        while ((globalMatch = globalRe.exec(source)) !== null) {
            globals.push({ name: globalMatch[1], value: parseInt(globalMatch[2], 10) });
        }

        const program: Program = {
            source,
            globals,
            setupBody: splitStatements(setupBody!),
            loopBody: splitStatements(loopBody!),
            libraryObjects,
            userFunctions,
        };
        return { program, diagnostics: [] };
    },

    createInstance(program: unknown, hostContext: HostInterface): unknown {
        const compiled = program as Program;
        const vars = new Map<string, LibraryValue>();
        for (const global of compiled.globals) vars.set(global.name, global.value);

        const libraryObjects = new Map<string, LibraryObjectRuntime>();
        for (const declaration of compiled.libraryObjects) {
            const runtime = createLibraryRuntime(declaration);
            if (runtime) libraryObjects.set(declaration.name, runtime);
        }

        const instance: Instance = {
            program: compiled,
            host: hostContext,
            vars,
            setupDone: false,
            steps: 0,
            pcBody: compiled.setupBody,
            pcIndex: 0,
            pcInLoop: false,
            libraryObjects,
            staticLibraries: new Map(),
            pendingMqttMessages: [],
        };
        return instance;
    },

    resume(instance: unknown): ExecutionResult {
        const inst = instance as Instance;
        const host = inst.host;
        inst.steps = 0;

        const consts: Record<string, number> = {
            HIGH: ARDUINO.HIGH,
            LOW: ARDUINO.LOW,
            INPUT: ARDUINO.INPUT,
            OUTPUT: ARDUINO.OUTPUT,
            INPUT_PULLUP: ARDUINO.INPUT_PULLUP,
            INPUT_PULLDOWN: ARDUINO.INPUT_PULLDOWN,
            WL_CONNECTED: 3,
            WIFI_STA: 1,
            true: 1,
            false: 0,
        };

        const emitLibraryEvent = (event: LibraryEvent): void => {
            host.emitLibraryEvent?.(event);
        };

        const resolveLibraryCall = (
            fn: string,
        ): { runtime: LibraryObjectRuntime; method: string } | null => {
            const dot = fn.indexOf('.');
            if (dot <= 0) return null;

            const objectName = fn.slice(0, dot);
            const method = fn.slice(dot + 1);
            if (objectName === 'Serial') return null;

            const declared = inst.libraryObjects.get(objectName);
            if (declared) return { runtime: declared, method };

            const definition = findLibrary(objectName);
            if (definition?.static) {
                let runtime = inst.staticLibraries.get(definition.id);
                if (!runtime) {
                    runtime = createStaticLibraryRuntime(definition);
                    inst.staticLibraries.set(definition.id, runtime);
                }
                return { runtime, method };
            }

            return null;
        };

        const evalExpr = (expr: string): LibraryValue => {
            const e = expr.trim().replace(/;$/, '');
            if (e === '') throw new Fault('Expresión vacía');

            // Serial.print("...") / Serial.println("...") / Serial.println(expr)
            const serialMatch = /^Serial\.(print|println)\s*\(([\s\S]*)\)$/.exec(e);
            if (serialMatch) {
                const arg = serialMatch[2].trim();
                if (arg === '') {
                    if (serialMatch[1] === 'println') host.serialPrintln('');
                } else if (parseStringLiteral(arg) !== null) {
                    const text = parseStringLiteral(arg)!;
                    if (serialMatch[1] === 'println') host.serialPrintln(text);
                    else host.serialPrint(text);
                } else {
                    const value = evalExpr(arg);
                    if (serialMatch[1] === 'println') host.serialPrintln(String(value));
                    else host.serialPrint(String(value));
                }
                return 0;
            }

            // Literal string
            const stringLiteral = parseStringLiteral(e);
            if (stringLiteral !== null) return stringLiteral;

            // Negación lógica: !expresion
            if (e.startsWith('!')) {
                return isTruthy(evalExpr(e.slice(1))) ? 0 : 1;
            }

            // Llamadas a funciones del core o métodos de librerías
            const callHead = /^([A-Za-z_][\w.]*)\s*\(/.exec(e);
            const callOpen = callHead ? callHead[0].length - 1 : -1;
            const callClose =
                callOpen >= 0 ? findMatchingDelimiter(e, callOpen, '(', ')') : -1;
            if (callHead && callClose === e.length - 1) {
                const fn = callHead[1];
                const argsRaw = e.slice(callOpen + 1, callClose).trim();
                const args = argsRaw === '' ? [] : splitArgs(argsRaw).map(evalExpr);

                const libraryCall = resolveLibraryCall(fn);
                if (libraryCall) {
                    try {
                        return invokeLibraryMethod(
                            libraryCall.runtime,
                            libraryCall.method,
                            args,
                            emitLibraryEvent,
                        );
                    } catch (error) {
                        if (error instanceof LibraryRuntimeError) {
                            throw new Fault(error.message);
                        }
                        throw error;
                    }
                }

                switch (fn) {
                    case 'pinMode':
                        host.pinMode(numberArg(args[0], fn), numberArg(args[1], fn));
                        return 0;
                    case 'digitalWrite':
                        host.digitalWrite(numberArg(args[0], fn), numberArg(args[1], fn));
                        return 0;
                    case 'digitalRead':
                        return host.digitalRead(numberArg(args[0], fn));
                    case 'analogRead':
                        return host.analogRead(numberArg(args[0], fn));
                    case 'analogWrite':
                        host.analogWrite(numberArg(args[0], fn), numberArg(args[1], fn));
                        return 0;
                    case 'delay':
                        host.delay(numberArg(args[0], fn));
                        throw new Fault('unreachable');
                    case 'delayMicroseconds':
                        host.delayMicroseconds(numberArg(args[0], fn));
                        throw new Fault('unreachable');
                    case 'millis':
                        return host.millis();
                    case 'micros':
                        return host.micros();
                    case 'Serial.begin':
                        return 0;
                    case 'String':
                        return String(args[0] ?? '');
                    default:
                        if (fn.includes('.')) {
                            const objectName = fn.slice(0, fn.indexOf('.'));
                            throw new Fault(`Objeto de librería no declarado: ${objectName}`);
                        }
                        throw new Fault(`Función no soportada en el subset: ${fn}()`);
                }
            }

            // Número literal
            if (/^-?\d+$/.test(e)) return parseInt(e, 10);
            if (/^0x[0-9a-f]+$/i.test(e)) return parseInt(e, 16);
            if (/^-?\d+\.\d+$/.test(e)) return Number(e);

            // Identificador / constante
            if (/^[A-Za-z_]\w*$/.test(e)) {
                if (e in consts) return consts[e];
                const value = inst.vars.get(e);
                if (value !== undefined) return value;
                // Nombre de función del sketch usado como valor (setCallback(cb))
                if (inst.program.userFunctions.has(e)) return e;
                throw new Fault(`Variable no definida: ${e}`);
            }

            // Paréntesis externos
            if (isWrappedInParentheses(e)) return evalExpr(e.slice(1, -1));

            // Operadores lógicos (menor precedencia)
            const orOperator = findTopLevelOperator(e, ['||']);
            if (orOperator) {
                const left = evalExpr(e.slice(0, orOperator.index));
                if (isTruthy(left)) return 1;
                return isTruthy(evalExpr(e.slice(orOperator.index + 2))) ? 1 : 0;
            }

            const andOperator = findTopLevelOperator(e, ['&&']);
            if (andOperator) {
                const left = evalExpr(e.slice(0, andOperator.index));
                if (!isTruthy(left)) return 0;
                return isTruthy(evalExpr(e.slice(andOperator.index + 2))) ? 1 : 0;
            }

            // Comparaciones (una sola, sin anidar)
            const comparison = findTopLevelOperator(e, ['==', '!=', '>=', '<=', '>', '<']);
            if (comparison) {
                const left = evalExpr(e.slice(0, comparison.index));
                const right = evalExpr(e.slice(comparison.index + comparison.operator.length));
                switch (comparison.operator) {
                    case '==':
                        return left === right ? 1 : 0;
                    case '!=':
                        return left !== right ? 1 : 0;
                    case '>=':
                        return numberArg(left, 'comparación') >= numberArg(right, 'comparación')
                            ? 1
                            : 0;
                    case '<=':
                        return numberArg(left, 'comparación') <= numberArg(right, 'comparación')
                            ? 1
                            : 0;
                    case '>':
                        return numberArg(left, 'comparación') > numberArg(right, 'comparación')
                            ? 1
                            : 0;
                    case '<':
                        return numberArg(left, 'comparación') < numberArg(right, 'comparación')
                            ? 1
                            : 0;
                }
            }

            // Aditivos (asociativos a izquierda)
            const additive = findTopLevelOperator(e, ['+', '-'], 'last');
            if (additive) {
                const left = evalExpr(e.slice(0, additive.index));
                const right = evalExpr(e.slice(additive.index + 1));
                if (additive.operator === '+') {
                    if (typeof left === 'string' || typeof right === 'string') {
                        return String(left) + String(right);
                    }
                    return numberArg(left, 'suma') + numberArg(right, 'suma');
                }
                return numberArg(left, 'resta') - numberArg(right, 'resta');
            }

            // Multiplicativos (asociativos a izquierda)
            const multiplicative = findTopLevelOperator(e, ['*', '/', '%'], 'last');
            if (multiplicative) {
                const left = evalExpr(e.slice(0, multiplicative.index));
                const right = evalExpr(e.slice(multiplicative.index + 1));
                switch (multiplicative.operator) {
                    case '*':
                        return numberArg(left, 'producto') * numberArg(right, 'producto');
                    case '/':
                        return numberArg(right, 'división') === 0
                            ? 0
                            : Math.floor(
                                  numberArg(left, 'división') / numberArg(right, 'división'),
                              );
                    case '%':
                        return numberArg(right, 'módulo') === 0
                            ? 0
                            : numberArg(left, 'módulo') % numberArg(right, 'módulo');
                }
            }

            throw new Fault(`Expresión no soportada: ${e}`);
        };

        const splitArgs = (source: string): string[] => {
            const out: string[] = [];
            let current = '';
            let depth = 0;
            let quote: '"' | "'" | null = null;

            for (let index = 0; index < source.length; index++) {
                const char = source[index];
                if (quote) {
                    current += char;
                    if (char === '\\') {
                        const next = source[index + 1];
                        if (next !== undefined) {
                            current += next;
                            index++;
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
                if (char === '(') depth++;
                else if (char === ')') depth--;
                if (char === ',' && depth === 0) {
                    out.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            if (current.trim()) out.push(current.trim());
            return out;
        };

        const execBlock = (statements: string[]): void => {
            for (const statement of statements) {
                inst.steps++;
                if (inst.steps > MAX_STEPS_PER_RESUME) throw new Fault('__PREEMPT__');
                execStmt(statement);
            }
        };

        const execStmt = (statement: string): void => {
            const s = statement.trim();
            if (!s) return;

            // if (cond) { ... } [else { ... }]  o  if (cond) statement;
            if (/^if\s*\(/.test(s)) {
                const openParen = s.indexOf('(');
                const closeParen = findMatchingDelimiter(s, openParen, '(', ')');
                if (closeParen < 0) throw new Fault('if sin paréntesis balanceados');
                const cond = s.slice(openParen + 1, closeParen);
                const rest = s.slice(closeParen + 1).trim();
                let thenPart: string;
                let elsePart = '';
                if (rest.startsWith('{')) {
                    const close = findMatchingDelimiter(rest, 0, '{', '}');
                    if (close < 0) throw new Fault('Bloque if sin cerrar');
                    thenPart = rest.slice(1, close);
                    const after = rest.slice(close + 1).trim();
                    if (after.startsWith('else')) {
                        const elseBody = after.slice(4).trim();
                        if (elseBody.startsWith('{')) {
                            const elseClose = findMatchingDelimiter(elseBody, 0, '{', '}');
                            elsePart =
                                elseClose >= 0 ? elseBody.slice(1, elseClose) : elseBody.slice(1);
                        } else {
                            elsePart = elseBody;
                        }
                    }
                } else {
                    thenPart = rest;
                }
                if (isTruthy(evalExpr(cond))) execBlock(splitStatements(thenPart));
                else if (elsePart) execBlock(splitStatements(elsePart));
                return;
            }

            // Declaración local: int x = expr; / const int x = expr;
            const declaration = /^(?:const\s+)?int\s+([A-Za-z_]\w*)\s*=\s*([\s\S]+);?$/.exec(s);
            if (declaration) {
                inst.vars.set(declaration[1], evalExpr(declaration[2]));
                return;
            }

            // Asignación: x = expr;  (el `(?!=)` evita confundir `==` con asignación)
            const assignment = /^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]+);?$/.exec(s);
            if (assignment) {
                inst.vars.set(assignment[1], evalExpr(assignment[2]));
                return;
            }

            // Llamada como statement (termina en ';')
            evalExpr(s.replace(/;$/, ''));
        };

        // Ejecución statement por statement con PC persistente: un delay a
        // mitad de loop() suspende y el próximo resume continúa exactamente
        // en el statement siguiente (no reinicia loop()).
        // `stopAtEndOfBody` se usa para el callback MQTT: al terminar el
        // cuerpo, se devuelve 'callback-done' en lugar de pasar a loop().
        const execute = (stopAtEndOfBody: boolean): ExecutionResult | 'callback-done' => {
            try {
                for (;;) {
                    if (inst.pcIndex >= inst.pcBody.length) {
                        if (stopAtEndOfBody) return 'callback-done';
                        if (!inst.pcInLoop) {
                            inst.setupDone = true;
                            inst.pcInLoop = true;
                            inst.pcBody = inst.program.loopBody;
                            inst.pcIndex = 0;
                            continue;
                        }
                        inst.pcIndex = 0; // nueva iteración de loop()
                        continue;
                    }
                    if (inst.steps >= MAX_STEPS_PER_RESUME) {
                        return stopAtEndOfBody
                            ? 'callback-done'
                            : { type: 'preempted', currentTimeUs: host.getTimeUs() };
                    }
                    const statement = inst.pcBody[inst.pcIndex];
                    inst.pcIndex++;
                    inst.steps++;
                    execStmt(statement);
                }
            } catch (error) {
                if (error instanceof SleepSignal) {
                    return stopAtEndOfBody
                        ? 'callback-done'
                        : { type: 'sleeping', wakeUpTimeUs: error.wakeUpTimeUs };
                }
                if (error instanceof Fault && error.message === '__PREEMPT__') {
                    return stopAtEndOfBody
                        ? 'callback-done'
                        : { type: 'preempted', currentTimeUs: host.getTimeUs() };
                }
                if (error instanceof ArduinoError) {
                    return {
                        type: 'faulted',
                        diagnostic: diag(
                            'ARDUINO_ERROR',
                            error.message,
                            lineOf(inst.program.source, 0),
                        ),
                    };
                }
                if (error instanceof Fault) {
                    return {
                        type: 'faulted',
                        diagnostic: diag(
                            'RUNTIME_ERROR',
                            error.message,
                            lineOf(inst.program.source, 0),
                        ),
                    };
                }
                throw error;
            }
        };

        // Entregar mensajes pendientes del broker ANTES de retomar el sketch
        // (como un paquete UART que procesa al despertar). El callback corre
        // con el mismo intérprete y presupuesto de steps; su cuerpo termina
        // con 'callback-done' en lugar de pasar a loop().
        for (const message of inst.pendingMqttMessages.splice(0)) {
            const callbackName = findMqttCallbackName(inst.libraryObjects.values());
            // Nadie escuchaba este tópico (sin setCallback): el mensaje se descarta
            if (!callbackName) continue;
            const fn = inst.program.userFunctions.get(callbackName);
            if (!fn) {
                return {
                    type: 'faulted',
                    diagnostic: diag(
                        'MQTT_CALLBACK_MISSING',
                        `PubSubClient.setCallback: la función ${callbackName}() no existe en el sketch`,
                        1,
                    ),
                };
            }
            // PubSubClient: callback(topic, payload, length) — los nombres de
            // parámetros son libres; se ligan posicionalmente.
            const paramNames = [
                fn.params[0] ?? 'topic',
                fn.params[1] ?? 'payload',
                fn.params[2] ?? 'length',
            ];
            const paramValues: LibraryValue[] = [
                String(message.topic),
                String(message.payload),
                message.payload.length,
            ];
            const snapshot = new Map<string, LibraryValue | undefined>();
            for (let index = 0; index < paramNames.length; index++) {
                snapshot.set(paramNames[index], inst.vars.get(paramNames[index]));
                inst.vars.set(paramNames[index], paramValues[index]);
            }
            const savedBody = inst.pcBody;
            const savedIndex = inst.pcIndex;
            const savedInLoop = inst.pcInLoop;
            const savedSteps = inst.steps;
            inst.pcBody = fn.body;
            inst.pcIndex = 0;
            inst.pcInLoop = true; // al terminar el cuerpo: 'callback-done'
            inst.steps = 0;
            const result = execute(true);
            inst.pcBody = savedBody;
            inst.pcIndex = savedIndex;
            inst.pcInLoop = savedInLoop;
            inst.steps = savedSteps;
            for (const [name, value] of snapshot) {
                if (value === undefined) inst.vars.delete(name);
                else inst.vars.set(name, value);
            }
            if (result !== 'callback-done') return result; // faulted
        }

        return execute(false) as ExecutionResult;
    },

    reset(instance: unknown): void {
        const inst = instance as Instance;
        inst.setupDone = false;
        inst.steps = 0;
        inst.pcBody = inst.program.setupBody;
        inst.pcIndex = 0;
        inst.pcInLoop = false;
        inst.pendingMqttMessages.length = 0;
        inst.vars.clear();
        for (const global of inst.program.globals) inst.vars.set(global.name, global.value);

        const emit = (event: LibraryEvent) => inst.host.emitLibraryEvent?.(event);
        for (const runtime of inst.libraryObjects.values()) resetLibraryRuntime(runtime, emit);
        for (const runtime of inst.staticLibraries.values()) resetLibraryRuntime(runtime, emit);
    },

    dispose(instance: unknown): void {
        const inst = instance as Instance;
        inst.vars.clear();
        inst.libraryObjects.clear();
        inst.staticLibraries.clear();
        inst.pendingMqttMessages.length = 0;
    },
};

/**
 * Encola un mensaje del broker para ser entregado al callback del sketch en el
 * próximo `resume` del MCU. Lo usa el Worker al recibir `MQTT_MESSAGE`.
 */
export function enqueueMqttMessage(
    instance: unknown,
    topic: string,
    payload: string,
): void {
    (instance as Instance).pendingMqttMessages.push({ topic, payload });
}
