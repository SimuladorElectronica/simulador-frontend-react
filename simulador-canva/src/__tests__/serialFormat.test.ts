import { describe, it, expect } from 'vitest';
import {
  filterSerialEntries,
  formatSerialBuffer,
  formatSerialEntry,
  serialBufferBytes,
  shouldAutoScroll,
} from '../core/editor/serialFormat';
import { UART_BAUD_RATES, DEFAULT_UART_BAUD } from '../core/editor/arduinoCompletions';

describe('Consola Serial UART (formato puro)', () => {
  it('formatea entradas como [us] texto', () => {
    expect(formatSerialEntry({ timeUs: 1234, text: 'hola\n' })).toBe('[1234us] hola\n');
    expect(formatSerialBuffer([{ timeUs: 1, text: 'a' }, { timeUs: 2, text: 'b' }])).toBe(
      '[1us] a\n[2us] b',
    );
  });

  it('filtra case-insensitive y query vacía no filtra', () => {
    const entries = [
      { timeUs: 1, text: 'LED ON' },
      { timeUs: 2, text: 'LED OFF' },
      { timeUs: 3, text: 'inicio' },
    ];
    expect(filterSerialEntries(entries, 'led')).toHaveLength(2);
    expect(filterSerialEntries(entries, '  ')).toHaveLength(3);
    expect(filterSerialEntries(entries, 'inicio')).toEqual([{ timeUs: 3, text: 'inicio' }]);
  });

  it('calcula bytes y autoscroll', () => {
    expect(serialBufferBytes([])).toBe(0);
    expect(serialBufferBytes([{ timeUs: 1, text: 'a' }])).toBeGreaterThan(0);
    expect(shouldAutoScroll(true, false)).toBe(true);
    expect(shouldAutoScroll(true, true)).toBe(false);
    expect(shouldAutoScroll(false, false)).toBe(false);
  });

  it('ofrece bauds UART típicos con 115200 por defecto', () => {
    expect(UART_BAUD_RATES).toContain(115200);
    expect(DEFAULT_UART_BAUD).toBe(115200);
  });
});
