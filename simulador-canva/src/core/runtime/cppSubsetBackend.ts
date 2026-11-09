import type { CodeDiagnostic, ExecutionResult, HostInterface, LanguageBackend } from '@types';
import { SleepSignal, ArduinoError } from './arduinoCore';
import { ARDUINO } from './esp32Profile';

/**
 * LanguageBackend mínimo para el subset C++ de Arduino:
 *  - funciones `void setup()` y `void loop()`
 *  - variables globales `int/const int` con inicializador
 *  - statements: asignación, llamada a función, if/else, return, bloque
 *  - expresiones: números, identificadores, llamadas, binarias, comparaciones, paréntesis
 *  - constantes: HIGH, LOW, INPUT, OUTPUT, INPUT_PULLUP, INPUT_PULLDOWN
 *
 * La ejecución se suspende por presupuesto de steps (preempted) o por
 * delay()/delayMicroseconds() (sleeping, vía SleepSignal del ArduinoCore).
 */

interface Program {
    source: string;
    globals: Array<{ name: string; value: number }>;
    setupBody: string[];
    loopBody: string[];
}

interface Instance {
    program: Program;
    host: HostInterface;
    vars: Map<string, number>;
    setupDone: boolean;
    /** Paso de instrucciones ejecutado en el resume actual */
    steps: number;
    /** Contador de programa: permite retomar a mitad de loop() tras un delay */
    pcBody: string[];
    pcIndex: number;
    pcInLoop: boolean;
}

const MAX_STEPS_PER_RESUME = 2000;

function diag(code: string, message: string, line = 1): CodeDiagnostic {
    return { severity: 'error', code, message, line, column: 1 };
}

/** Extrae el cuerpo { ... } de `void <name>()` con matching de llaves */
function extractFunction(source: string, name: string): string | null {
    const re = new RegExp(`void\\s+${name}\\s*\\(\\s*\\)\\s*\\{`);
    const m = re.exec(source);
    if (!m) return null;
    let i = m.index + m[0].length;
    let depth = 1;
    let body = '';
    while (i < source.length && depth > 0) {
        const c = source[i];
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) break;
        }
        body += c;
        i++;
    }
    return depth === 0 ? body : null;
}

/** Divide un cuerpo en statements terminados en ';' o bloques if/else */
function splitStatements(body: string): string[] {
    const out: string[] = [];
    let cur = '';
    let depth = 0;
    let paren = 0;
    for (let i = 0; i < body.length; i++) {
        const c = body[i];
        cur += c;
        if (c === '(') paren++;
        else if (c === ')') paren--;
        else if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0 && paren === 0) {
                // Si sigue un `else`, el statement if aún no termina
                const rest = body.slice(i + 1).trimStart();
                if (!rest.startsWith('else')) {
                    out.push(cur.trim());
                    cur = '';
                }
            }
        } else if (c === ';' && depth === 0 && paren === 0) {
            out.push(cur.trim());
            cur = '';
        }
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter((s) => s.length > 0);
}

class Fault extends Error {}

function lineOf(source: string, offset: number): number {
    return source.slice(0, offset).split('\n').length;
}

export const cppSubsetBackend: LanguageBackend = {
    compile(source: string, platformProfile: string) {
        const diagnostics: CodeDiagnostic[] = [];
        if (platformProfile !== 'esp32@1') {
            diagnostics.push(diag('UNSUPPORTED_PLATFORM', `Plataforma no soportada: ${platformProfile}`));
        }
        const setupBody = extractFunction(source, 'setup');
        const loopBody = extractFunction(source, 'loop');
        if (setupBody === null) diagnostics.push(diag('MISSING_SETUP', 'No se encontró `void setup()`'));
        if (loopBody === null) diagnostics.push(diag('MISSING_LOOP', 'No se encontró `void loop()`'));
        // Llaves balanceadas (chequeo rápido)
        let depth = 0;
        for (const c of source) {
            if (c === '{') depth++;
            else if (c === '}') depth--;
            if (depth < 0) break;
        }
        if (depth !== 0) diagnostics.push(diag('UNBALANCED_BRACES', 'Llaves desbalanceadas en el sketch'));

        if (diagnostics.length > 0) return { diagnostics };

        const globals: Array<{ name: string; value: number }> = [];
        const globalRe = /(?:const\s+)?int\s+([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*;/g;
        let gm: RegExpExecArray | null;
        while ((gm = globalRe.exec(source)) !== null) {
            globals.push({ name: gm[1], value: parseInt(gm[2], 10) });
        }

        const program: Program = {
            source,
            globals,
            setupBody: splitStatements(setupBody!),
            loopBody: splitStatements(loopBody!),
        };
        return { program, diagnostics: [] };
    },

    createInstance(program: unknown, hostContext: HostInterface): unknown {
        const p = program as Program;
        const vars = new Map<string, number>();
        for (const g of p.globals) vars.set(g.name, g.value);
        const instance: Instance = {
            program: p,
            host: hostContext,
            vars,
            setupDone: false,
            steps: 0,
            pcBody: p.setupBody,
            pcIndex: 0,
            pcInLoop: false,
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
        };

        const evalExpr = (expr: string): number => {
            const e = expr.trim().replace(/;$/, '');
            // Serial.print("...") / Serial.println("...") / Serial.println(expr)
            const serialMatch = /^Serial\.(print|println)\s*\(([\s\S]*)\)$/.exec(e);
            if (serialMatch) {
                const arg = serialMatch[2].trim();
                if (arg.startsWith('"')) {
                    const text = arg.replace(/^"|"$/g, '');
                    if (serialMatch[1] === 'println') host.serialPrintln(text);
                    else host.serialPrint(text);
                } else if (arg === '') {
                    if (serialMatch[1] === 'println') host.serialPrintln('');
                } else {
                    const v = evalExpr(arg);
                    if (serialMatch[1] === 'println') host.serialPrintln(String(v));
                    else host.serialPrint(String(v));
                }
                return 0;
            }
            // Llamadas a funciones del core
            const call = /^([A-Za-z_][\w.]*)\s*\(([\s\S]*)\)$/.exec(e);
            if (call) {
                const fn = call[1];
                const argsRaw = call[2].trim();
                const args = argsRaw === '' ? [] : splitArgs(argsRaw).map(evalExpr);
                switch (fn) {
                    case 'pinMode': host.pinMode(args[0], args[1]); return 0;
                    case 'digitalWrite': host.digitalWrite(args[0], args[1]); return 0;
                    case 'digitalRead': return host.digitalRead(args[0]);
                    case 'analogRead': return host.analogRead(args[0]);
                    case 'analogWrite': host.analogWrite(args[0], args[1]); return 0;
                    case 'delay': host.delay(args[0]); throw new Fault('unreachable');
                    case 'delayMicroseconds': host.delayMicroseconds(args[0]); throw new Fault('unreachable');
                    case 'millis': return host.millis();
                    case 'micros': return host.micros();
                    case 'Serial.begin': return 0;
                    default: throw new Fault(`Función no soportada en el subset: ${fn}()`);
                }
            }
            // Número literal
            if (/^-?\d+$/.test(e)) return parseInt(e, 10);
            // Identificador / constante
            if (/^[A-Za-z_]\w*$/.test(e)) {
                if (e in consts) return consts[e];
                const v = inst.vars.get(e);
                if (v === undefined) throw new Fault(`Variable no definida: ${e}`);
                return v;
            }
            // Comparaciones (una sola, sin anidar)
            const cmp = /^([\s\S]+?)(==|!=|>=|<=|>|<)([\s\S]+)$/.exec(e);
            if (cmp && !e.includes('(')) {
                const a = evalExpr(cmp[1]);
                const b = evalExpr(cmp[3]);
                switch (cmp[2]) {
                    case '==': return a === b ? 1 : 0;
                    case '!=': return a !== b ? 1 : 0;
                    case '>=': return a >= b ? 1 : 0;
                    case '<=': return a <= b ? 1 : 0;
                    case '>': return a > b ? 1 : 0;
                    case '<': return a < b ? 1 : 0;
                }
            }
            // Expresión binaria simple: a OP b (OP en + - * / %, sin llamadas ni paréntesis anidados salvo un nivel)
            const bin = /^([\s\S]+?)([+\-*/%])([\s\S]+)$/.exec(e);
            if (bin && !/\(.*\(/.test(e)) {
                // Evitar confundir el '-' inicial de un número negativo
                const a = evalExpr(bin[1]);
                const b = evalExpr(bin[3]);
                switch (bin[2]) {
                    case '+': return a + b;
                    case '-': return a - b;
                    case '*': return a * b;
                    case '/': return b === 0 ? 0 : Math.floor(a / b);
                    case '%': return b === 0 ? 0 : a % b;
                }
            }
            // Paréntesis externos
            if (e.startsWith('(') && e.endsWith(')')) return evalExpr(e.slice(1, -1));
            throw new Fault(`Expresión no soportada: ${e}`);
        };

        const splitArgs = (s: string): string[] => {
            const out: string[] = [];
            let cur = '';
            let depth = 0;
            for (const c of s) {
                if (c === '(') depth++;
                else if (c === ')') depth--;
                if (c === ',' && depth === 0) {
                    out.push(cur.trim());
                    cur = '';
                } else cur += c;
            }
            if (cur.trim()) out.push(cur.trim());
            return out;
        };

        const execBlock = (stmts: string[]): void => {
            for (const stmt of stmts) {
                inst.steps++;
                if (inst.steps > MAX_STEPS_PER_RESUME) throw new Fault('__PREEMPT__');
                execStmt(stmt);
            }
        };

        const execStmt = (stmt: string): void => {
            const s = stmt.trim();
            if (!s) return;
            // if (cond) { ... } [else { ... }]  o  if (cond) statement;
            if (/^if\s*\(/.test(s)) {
                const condEnd = s.indexOf(')');
                const cond = s.slice(s.indexOf('(') + 1, condEnd);
                const rest = s.slice(condEnd + 1).trim();
                let thenPart: string;
                let elsePart = '';
                if (rest.startsWith('{')) {
                    // Cierre correspondiente a la llave de apertura (matching, no lastIndexOf)
                    let depth = 0;
                    let close = -1;
                    for (let i = 0; i < rest.length; i++) {
                        if (rest[i] === '{') depth++;
                        else if (rest[i] === '}') {
                            depth--;
                            if (depth === 0) {
                                close = i;
                                break;
                            }
                        }
                    }
                    thenPart = rest.slice(1, close);
                    const after = rest.slice(close + 1).trim();
                    if (after.startsWith('else')) {
                        const elseBody = after.slice(4).trim();
                        elsePart = elseBody.startsWith('{') ? elseBody.slice(1, elseBody.lastIndexOf('}')) : elseBody;
                    }
                } else {
                    thenPart = rest;
                }
                if (evalExpr(cond) !== 0) execBlock(splitStatements(thenPart));
                else if (elsePart) execBlock(splitStatements(elsePart));
                return;
            }
            // Declaración local: int x = expr; / const int x = expr;
            const decl = /^(?:const\s+)?int\s+([A-Za-z_]\w*)\s*=\s*([\s\S]+);?$/.exec(s);
            if (decl) {
                inst.vars.set(decl[1], evalExpr(decl[2]));
                return;
            }
            // Asignación: x = expr;
            const assign = /^([A-Za-z_]\w*)\s*=\s*([\s\S]+);?$/.exec(s);
            if (assign && !s.includes('==')) {
                inst.vars.set(assign[1], evalExpr(assign[2]));
                return;
            }
            // Llamada como statement (termina en ';')
            const callStmt = s.replace(/;$/, '');
            evalExpr(callStmt);
        };

        try {
            // Ejecutar statement por statement con PC persistente:
            // un delay a mitad de loop() suspende y el próximo resume continúa
            // exactamente en el statement siguiente (no reinicia loop()).
            for (;;) {
                if (inst.pcIndex >= inst.pcBody.length) {
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
                    return { type: 'preempted', currentTimeUs: host.getTimeUs() };
                }
                const stmt = inst.pcBody[inst.pcIndex];
                inst.pcIndex++; // avanzar ANTES de ejecutar: si duerme, retoma en el siguiente
                inst.steps++;
                execStmt(stmt);
            }
        } catch (err) {
            if (err instanceof SleepSignal) {
                return { type: 'sleeping', wakeUpTimeUs: err.wakeUpTimeUs };
            }
            if (err instanceof Fault && err.message === '__PREEMPT__') {
                return { type: 'preempted', currentTimeUs: host.getTimeUs() };
            }
            if (err instanceof ArduinoError) {
                return {
                    type: 'faulted',
                    diagnostic: diag('ARDUINO_ERROR', err.message, lineOf(inst.program.source, 0)),
                };
            }
            if (err instanceof Fault) {
                return {
                    type: 'faulted',
                    diagnostic: diag('RUNTIME_ERROR', err.message, lineOf(inst.program.source, 0)),
                };
            }
            throw err;
        }
    },

    reset(instance: unknown): void {
        const inst = instance as Instance;
        inst.setupDone = false;
        inst.steps = 0;
        inst.pcBody = inst.program.setupBody;
        inst.pcIndex = 0;
        inst.pcInLoop = false;
        inst.vars.clear();
        for (const g of inst.program.globals) inst.vars.set(g.name, g.value);
    },

    dispose(instance: unknown): void {
        const inst = instance as Instance;
        inst.vars.clear();
    },
};
