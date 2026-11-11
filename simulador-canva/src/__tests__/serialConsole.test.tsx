// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SerialConsole } from '../UIcomponents/SerialConsole';

describe('SerialConsole (interfaz UART)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it('muestra la salida RX con timestamps y controles UART', async () => {
    const entries = [
      { timeUs: 1000, text: 'ESP32 listo\n' },
      { timeUs: 2000, text: 'LED ON\n' },
    ];
    await act(async () => {
      root.render(<SerialConsole entries={entries} onClear={() => {}} />);
    });
    const out = container.querySelector('[data-testid="serial-output"]')!;
    expect(out.textContent).toContain('[1000us] ESP32 listo');
    expect(out.textContent).toContain('[2000us] LED ON');

    // Controles propios de una consola UART
    expect(container.querySelector('select[aria-label="Baud rate"]')).not.toBeNull();
    expect(container.textContent).toContain('autoscroll');
    expect(container.textContent).toContain('pausa');
    expect(container.textContent).toContain('Limpiar');
    expect(container.textContent).toContain('Copiar');
    expect(container.textContent).toContain('Descargar .txt');
    expect(container.textContent).toContain('TX: no conectado');
    await act(async () => root.unmount());
  });

  it('estado vacío muestra "(sin salida)"', async () => {
    await act(async () => {
      root.render(<SerialConsole entries={[]} onClear={() => {}} />);
    });
    expect(container.querySelector('[data-testid="serial-output"]')?.textContent).toBe(
      '(sin salida)',
    );
    await act(async () => root.unmount());
  });

  it('Limpiar llama a onClear (el store vacía el buffer)', async () => {
    const onClear = vi.fn();
    await act(async () => {
      root.render(<SerialConsole entries={[{ timeUs: 1, text: 'x' }]} onClear={onClear} />);
    });
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Limpiar',
    )!;
    await act(async () => {
      btn.click();
    });
    expect(onClear).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('expone el input de filtrado (la lógica se cubre en serialFormat.test)', async () => {
    const entries = [
      { timeUs: 1, text: 'LED ON' },
      { timeUs: 2, text: 'inicio' },
    ];
    await act(async () => {
      root.render(<SerialConsole entries={entries} onClear={() => {}} />);
    });
    const input = container.querySelector(
      'input[aria-label="Filtrar salida serie"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.placeholder).toContain('Filtrar');
    await act(async () => root.unmount());
  });
});
