import type { Netlist, SolverSolution } from '@types';
import type { GpioStatesInput } from '../runtime/gpioState';
import { findGpioState } from '../runtime/gpioState';
import { ESP32_PROFILE } from '../runtime/esp32Profile';

/* ------------------------------------------------------------------ */
/*  Pequeño resolvedor de sistemas lineales Ax = b                    */
/*  Eliminación de Gauss con pivoteo parcial. No hay dependencias.    */
/* ------------------------------------------------------------------ */

function gaussSolve(A: number[][], b: number[]): number[] | null {
    const n = b.length;
    const M: number[][] = [];
    for (let i = 0; i < n; i++) {
        M[i] = [...A[i], b[i]];
    }

    for (let col = 0; col < n; col++) {
        let maxRow = col;
        let maxVal = Math.abs(M[col][col]);
        for (let row = col + 1; row < n; row++) {
            const v = Math.abs(M[row][col]);
            if (v > maxVal) {
                maxVal = v;
                maxRow = row;
            }
        }

        if (maxVal < 1e-12) {
            return null;
        }

        if (maxRow !== col) {
            const tmp = M[col];
            M[col] = M[maxRow];
            M[maxRow] = tmp;
        }

        const pivot = M[col][col];
        for (let row = col + 1; row < n; row++) {
            const factor = M[row][col] / pivot;
            for (let k = col; k <= n; k++) {
                M[row][k] -= factor * M[col][k];
            }
        }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = M[i][n];
        for (let j = i + 1; j < n; j++) {
            sum -= M[i][j] * x[j];
        }
        x[i] = sum / M[i][i];
    }

    return x;
}

/* ------------------------------------------------------------------ */
/*  Modelos de componentes no lineales                                */
/* ------------------------------------------------------------------ */

/** Modelo del LED: I(V) = (V - Vf) / Rs si V > Vf, else ~0. */
function ledModel(v: number, params: Record<string, number>): { i: number; g: number } {
    const vf = params.forwardVoltage ?? 1.8;
    const rs = params.seriesResistance ?? 10;
    const gmin = 1e-9;

    if (v > vf) {
        return { i: (v - vf) / rs, g: 1 / rs };
    }
    return { i: 0, g: gmin };
}

/**
 * Un monitor con `action: 'destroy'` marca el elemento con `destroyed = 1`:
 * a partir de ahí se comporta como un circuito ABIERTO (no se estampa en la
 * MNA y no circula corriente). La referencia de tierra nunca se destruye:
 * perderla volvería singular toda la matriz.
 */
function isDestroyed(elem: Netlist['elements'][number]): boolean {
    return elem.primitive !== 'groundRef' && elem.params.destroyed === 1;
}

/* ------------------------------------------------------------------ */
/*  Solver nodal (MNA - Análisis Nodal Modificado) con Newton-Raphson */
/* ------------------------------------------------------------------ */

interface MNASystem {
    n: number;
    A: number[][];
    b: number[];
    nodeIndex: Map<string, number>;
    vsIndex: Map<string, number>;
    /**
     * Nets que son referencia 0 V. Hay uno por cada `groundRef` del netlist:
     * así dos placas sin cable de tierra común no dejan la segunda flotando
     * (matriz singular). Todas las tierras de la simulación son el mismo 0 V.
     */
    referenceNets: Set<string>;
}

function buildMNA(
    netlist: Netlist,
    previousVoltages: Record<string, number>,
    gpioStates?: GpioStatesInput,
): MNASystem {
    const nodeIndex = new Map<string, number>();
    const vsIndex = new Map<string, number>();

    const referenceNets = new Set<string>();
    for (const elem of netlist.elements) {
        if (elem.primitive === 'groundRef' && elem.terminals.pin) {
            referenceNets.add(elem.terminals.pin);
        }
    }

    // Nets con al menos un terminal conectado (evitar islas flotantes)
    const connectedNets = new Set<string>();
    for (const elem of netlist.elements) {
        for (const netId of Object.values(elem.terminals) as string[]) {
            if (netId && !referenceNets.has(netId)) {
                connectedNets.add(netId);
            }
        }
    }

    let nodeCount = 0;
    for (const net of netlist.nets) {
        if (!referenceNets.has(net.id) && connectedNets.has(net.id)) {
            nodeIndex.set(net.id, nodeCount++);
        }
    }

    // Fuentes ideales duplicadas: dos placas conectadas al mismo riel (mismos
    // nets y misma tensión) imponen exactamente la misma ecuación. En MNA eso
    // deja filas redundantes (matriz singular) aunque el circuito sea válido.
    // Se estampa una sola; la corriente entre fuentes ideales idénticas es
    // indeterminada, así que repartirla no aporta nada al resultado.
    const activeVoltageSources = new Set<string>();
    const sourceRails = new Set<string>();
    for (const elem of netlist.elements) {
        if (elem.primitive !== 'voltageSource' || isDestroyed(elem)) continue;
        const railKey = `${elem.terminals.positive ?? ''}|${elem.terminals.negative ?? ''}|${elem.params.voltage ?? 0}`;
        if (sourceRails.has(railKey)) continue;
        sourceRails.add(railKey);
        activeVoltageSources.add(elem.id);
    }

    let vsCount = 0;
    for (const elem of netlist.elements) {
        if (activeVoltageSources.has(elem.id)) {
            vsIndex.set(elem.id, nodeCount + vsCount++);
        }
    }

    const n = nodeCount + vsCount;
    const A: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const b: number[] = Array(n).fill(0);

    const getNodeIndex = (netId: string): number | null => {
        if (!netId || referenceNets.has(netId)) return null;
        return nodeIndex.get(netId) ?? null;
    };

    const addConductance = (
        n1: number | null,
        n2: number | null,
        g: number,
        iSrc: number,
    ): void => {
        if (n1 !== null) {
            A[n1][n1] += g;
            b[n1] -= iSrc;
        }
        if (n2 !== null) {
            A[n2][n2] += g;
            b[n2] += iSrc;
        }
        if (n1 !== null && n2 !== null) {
            A[n1][n2] -= g;
            A[n2][n1] -= g;
        }
    };

    for (const elem of netlist.elements) {
        if (isDestroyed(elem)) continue; // circuito abierto: no se estampa en la MNA
        // Fuente ideal duplicada en el mismo riel: ya se estampó la primera.
        if (elem.primitive === 'voltageSource' && !activeVoltageSources.has(elem.id)) continue;
        const t = elem.terminals;
        const p = elem.params;

        switch (elem.primitive) {
            case 'groundRef':
                break;

            case 'resistor': {
                const r = p.resistance ?? 1000;
                const g = 1 / r;
                const ports = Object.values(t) as string[];
                const p1 = getNodeIndex(ports[0] ?? '');
                const p2 = getNodeIndex(ports[1] ?? '');
                addConductance(p1, p2, g, 0);
                break;
            }

            case 'voltageSource': {
                const v = p.voltage ?? 0;
                const pos = getNodeIndex(t.positive ?? '');
                const neg = getNodeIndex(t.negative ?? '');
                const vsIdx = vsIndex.get(elem.id);

                if (vsIdx === undefined) break;

                if (pos !== null) A[vsIdx][pos] += 1;
                if (neg !== null) A[vsIdx][neg] -= 1;
                if (pos !== null) A[pos][vsIdx] += 1;
                if (neg !== null) A[neg][vsIdx] -= 1;
                b[vsIdx] = v;

                // Nota: outputResistance (Rout) es una resistencia EN SERIE con la
                // fuente ideal. Modelarla como resistor en paralelo entre pos/neg
                // sería incorrecto (actuaría como carga: V/Rout = 33A perdidos).
                // Como Rout es típicamente pequeña (0.1Ω), se aproxima la fuente
                // como ideal; Rout se conserva en params para futuros modelos serie.
                break;
            }

            case 'led': {
                const anode = getNodeIndex(t.anode ?? '');
                const cathode = getNodeIndex(t.cathode ?? '');
                const vaPrev = anode !== null ? (previousVoltages[t.anode ?? ''] ?? 0) : 0;
                const vcPrev = cathode !== null ? (previousVoltages[t.cathode ?? ''] ?? 0) : 0;
                const vPrev = vaPrev - vcPrev;

                const { i, g } = ledModel(vPrev, p);
                const iNorton = i - g * vPrev;

                if (anode !== null) {
                    A[anode][anode] += g;
                    b[anode] -= iNorton;
                }
                if (cathode !== null) {
                    A[cathode][cathode] += g;
                    b[cathode] += iNorton;
                }
                if (anode !== null && cathode !== null) {
                    A[anode][cathode] -= g;
                    A[cathode][anode] -= g;
                }
                break;
            }

            case 'gpio': {
                const pad = getNodeIndex(t.pad ?? '');
                const supply = getNodeIndex(t.supply ?? '');
                const ground = getNodeIndex(t.ground ?? '');
                const pullUp = p.pullUpResistance ?? ESP32_PROFILE.pullUpResistance;
                const pullDown = p.pullDownResistance ?? ESP32_PROFILE.pullDownResistance;
                const rout = p.outputResistance ?? ESP32_PROFILE.outputResistance;
                const gpioNumber = p.gpioNumber;
                const st =
                    gpioNumber !== undefined
                        ? findGpioState(gpioStates, elem.componentId, gpioNumber)
                        : undefined;

                if (st && st.mode === 'output') {
                    // Driver push-pull: fuente Thevenin Vout con resistencia serie Rout
                    // hacia ground. Equivalente Norton: G = 1/Rout, Isrc = G * Vout
                    // inyectada en el pad. PWM se promedia en DC (Vout = 3.3*duty/255).
                    const vout =
                        st.pwmDuty !== null
                            ? (st.pwmDuty / ESP32_PROFILE.pwmMax) * ESP32_PROFILE.logicVoltage
                            : st.outputLevel === 1
                              ? ESP32_PROFILE.logicVoltage
                              : 0;
                    const g = 1 / rout;
                    // KCL en el pad: G*Vpad - G*Vth + I_carga = 0  =>  b_pad = +G*Vth.
                    // addConductance hace b[n1] -= iSrc, por lo que iSrc = -G*Vth.
                    addConductance(pad, ground, g, -g * vout);
                } else if (st) {
                    // Entrada: solo el pull correspondiente al modo.
                    // INPUT plano es alta impedancia, pero necesita una conductancia
                    // de fuga mínima a tierra para no dejar el nodo flotante
                    // (fila de ceros -> matriz singular).
                    // Nota: `ground` puede ser null (= nodo de referencia, 0V);
                    // addConductance lo maneja, por eso no se exige ground !== null.
                    if (st.mode === 'inputPullUp' && pad !== null && supply !== null) {
                        addConductance(pad, supply, 1 / pullUp, 0);
                    } else if (st.mode === 'inputPullDown' && pad !== null) {
                        addConductance(pad, ground, 1 / pullDown, 0);
                    } else if (st.mode === 'input' && pad !== null) {
                        addConductance(pad, ground, 1e-7, 0);
                    }
                } else {
                    // Sin estado de runtime (todavía no se ejecutó pinMode/digitalWrite):
                    // el pin arranca en ALTA IMPEDANCIA, como un ESP32 recién encendido.
                    // Activar pull-up y pull-down a la vez (lo anterior) formaba un
                    // divisor 45k/45k que dejaba TODOS los pines en 1.65 V ficticios
                    // y consumía ~0.8 mA del regulador interno sin que hubiera código.
                    // Solo una conductancia de fuga mínima evita la matriz singular.
                    if (pad !== null) {
                        addConductance(pad, ground, 1e-7, 0);
                    }
                }
                break;
            }

            case 'switch': {
                const ports = Object.values(t) as string[];
                const p1 = getNodeIndex(ports[0] ?? '');
                const p2 = getNodeIndex(ports[1] ?? '');
                const closed = p.closed ?? false;
                const g = closed ? 1 / (p.onResistance ?? 0.1) : 1e-9;
                addConductance(p1, p2, g, 0);
                break;
            }

            case 'potentiometer': {
                const ports = Object.values(t) as string[];
                const p1 = getNodeIndex(ports[0] ?? '');
                const p2 = getNodeIndex(ports[1] ?? '');
                const r = p.resistance ?? 10000;
                addConductance(p1, p2, 1 / r, 0);
                break;
            }
        }
    }

    return { n, A, b, nodeIndex, vsIndex, referenceNets };
}

function netVoltagesToMap(x: number[], mna: MNASystem): Record<string, number> {
    const voltages: Record<string, number> = {};
    for (const netId of mna.referenceNets) {
        voltages[netId] = 0;
    }
    for (const [netId, idx] of mna.nodeIndex) {
        voltages[netId] = x[idx];
    }
    return voltages;
}

function getVoltage(nodeVoltages: Record<string, number>, netId: string | undefined): number {
    if (!netId) return 0;
    return nodeVoltages[netId] ?? 0;
}

/**
 * Ejecuta el análisis nodal con Newton-Raphson.
 * Devuelve una SolverSolution estrictamente tipada.
 */
export function solve(netlist: Netlist, gpioStates?: GpioStatesInput): SolverSolution {
    const diagnostics: SolverSolution['diagnostics'] = [];
    const elementResults: SolverSolution['elementResults'] = {};

    let previousVoltages: Record<string, number> = {};
    let mna = buildMNA(netlist, previousVoltages, gpioStates);

    if (mna.n === 0) {
        return {
            nodeVoltages: {},
            elementResults,
            diagnostics: ['floatingIsland'],
            converged: true,
            iterations: 0,
        };
    }

    let converged = false;
    let iterations = 0;
    const maxIterations = 50;
    const tolerance = 1e-6;
    let x: number[] | null = null;

    for (let it = 0; it < maxIterations; it++) {
        iterations = it + 1;
        mna = buildMNA(netlist, previousVoltages, gpioStates);
        x = gaussSolve(mna.A, mna.b);

        if (x === null) {
            diagnostics.push('singular');
            break;
        }

        const voltages = netVoltagesToMap(x, mna);

        let maxError = 0;
        for (const netId of Object.keys(voltages)) {
            const prev = previousVoltages[netId] ?? 0;
            const curr = voltages[netId];
            const err = Math.abs(curr - prev);
            if (err > maxError) maxError = err;
        }

        previousVoltages = voltages;

        if (maxError < tolerance) {
            converged = true;
            break;
        }
    }

    if (!converged) {
        diagnostics.push('noConvergence');
    }

    const nodeVoltages = previousVoltages;

    for (const elem of netlist.elements) {
        const t = elem.terminals;
        const p = elem.params;
        let voltage: number;
        let current: number;

        switch (elem.primitive) {
            case 'resistor': {
                const ports = Object.values(t) as string[];
                const v1 = getVoltage(nodeVoltages, ports[0]);
                const v2 = getVoltage(nodeVoltages, ports[1]);
                voltage = v1 - v2;
                const r = p.resistance ?? 1000;
                current = voltage / r;
                break;
            }
            case 'led': {
                const va = getVoltage(nodeVoltages, t.anode);
                const vc = getVoltage(nodeVoltages, t.cathode);
                voltage = va - vc;
                const { i } = ledModel(voltage, p);
                current = i;
                break;
            }
            case 'voltageSource': {
                const vp = getVoltage(nodeVoltages, t.positive);
                const vn = getVoltage(nodeVoltages, t.negative);
                voltage = vp - vn;
                // Corriente real entregada por la fuente: es la variable de corriente
                // MNA (x[vsIndex]). En el sistema, Iv entra en `positive` y sale por
                // `negative`, por lo que la corriente entregada al nodo positivo es -Iv.
                // (Antes se aproximaba como (V - Vfuente)/Rout, que da ~0 con fuente ideal.)
                const vsIdx = mna.vsIndex.get(elem.id);
                if (x !== null && vsIdx !== undefined) {
                    current = -x[vsIdx];
                } else {
                    const rout = p.outputResistance ?? 0;
                    current = rout > 0 ? (voltage - (p.voltage ?? 0)) / rout : 0;
                }
                break;
            }
            case 'gpio': {
                const vpad = getVoltage(nodeVoltages, t.pad);
                voltage = vpad;
                current = 0;
                break;
            }
            default: {
                voltage = 0;
                current = 0;
                break;
            }
        }

        const destroyed = isDestroyed(elem);
        if (destroyed) current = 0; // circuito abierto: la tensión sigue siendo la de sus nodos

        const power = voltage * current;
        let conducting: boolean | undefined;
        if (elem.primitive === 'led') {
            conducting = !destroyed && voltage > (p.forwardVoltage ?? 1.8);
        }

        elementResults[elem.id] = {
            voltage,
            current,
            power,
            ...(conducting !== undefined ? { conducting } : {}),
            ...(destroyed ? { destroyed: true } : {}),
        };
    }

    return {
        nodeVoltages,
        elementResults,
        diagnostics,
        converged,
        iterations,
    };
}