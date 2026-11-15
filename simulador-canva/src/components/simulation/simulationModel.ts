import type { SimulationSnapshot } from '../../stores/simulationStore';

export const fmt = (v: unknown) =>
    typeof v === 'number' ? Number(v.toPrecision(4)).toString() : String(v ?? '—');

export type StateEntries = Array<[string, Record<string, unknown>]>;

export function splitEntries(states: SimulationSnapshot['states']): {
    elementEntries: StateEntries;
    componentEntries: StateEntries;
} {
    const entries = Object.entries(states);
    return {
        elementEntries: entries.filter(([id]) => id.includes(':')),
        componentEntries: entries.filter(([id]) => !id.includes(':')),
    };
}
