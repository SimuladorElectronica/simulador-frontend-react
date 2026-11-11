// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { sidebarStore } from '../stores/sidebarStore';

// Seleccionar un MCU abre el editor (lazy). Mock para no descargar Monaco.
vi.mock('@monaco-editor/react', () => ({ default: () => null }));

import { Sidebar } from '../UIcomponents/Sidebar';

describe('Sidebar: pestañas Código / Componentes', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    ManifestRegistry.init();
    documentStore.getDocument().components.length = 0;
    documentStore.getDocument().wires.length = 0;
    documentStore.getDocument().programs.length = 0;
    programEditorStore.reset();
    sidebarStore.setTab('code');
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const tabs = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panel = (id: string) =>
    container.querySelector<HTMLElement>(`#sidebar-panel-${id}`)!;
  const tab = (label: string) =>
    tabs().find((b) => b.textContent === label)!;

  it('renderiza el selector arriba y arranca en la pestaña Código', async () => {
    await act(async () => {
      root.render(<Sidebar onAddComponent={() => {}} />);
    });

    expect(tabs().map((b) => b.textContent)).toEqual(['Código', 'Componentes']);
    expect(tab('Código').getAttribute('aria-selected')).toBe('true');
    expect(tab('Componentes').getAttribute('aria-selected')).toBe('false');
    expect(panel('code').style.display).toBe('flex');
    expect(panel('components').style.display).toBe('none');
    // El editor arranca colapsado (Monaco no se descarga)
    expect(container.textContent).toContain('Abrir editor de código');

    await act(async () => root.unmount());
  });

  it('al elegir Componentes ocupa el espacio y oculta el editor', async () => {
    await act(async () => {
      root.render(<Sidebar onAddComponent={() => {}} />);
    });
    await act(async () => {
      tab('Componentes').click();
    });

    expect(tab('Componentes').getAttribute('aria-selected')).toBe('true');
    expect(panel('components').style.display).toBe('flex');
    expect(panel('code').style.display).toBe('none');
    expect(container.textContent).toContain('Arrastra al lienzo');

    await act(async () => root.unmount());
  });

  it('seleccionar un ESP32 en el canvas abre la pestaña Código', async () => {
    const esp = documentStore.addComponent('core/esp32@1', { x: 0, y: 0 });
    await act(async () => {
      root.render(<Sidebar onAddComponent={() => {}} />);
    });
    // Nos vamos a Componentes...
    await act(async () => {
      tab('Componentes').click();
    });
    expect(panel('code').style.display).toBe('none');

    // ...y al seleccionar el ESP32 vuelve a Código
    await act(async () => {
      programEditorStore.selectMcu(esp.id);
    });
    expect(panel('code').style.display).toBe('flex');
    expect(panel('components').style.display).toBe('none');

    await act(async () => root.unmount());
  });

  it('la paleta notifica el componente elegido (doble clic) al canvas', async () => {
    const onAdd = vi.fn();
    await act(async () => {
      root.render(<Sidebar onAddComponent={onAdd} />);
    });
    await act(async () => {
      tab('Componentes').click();
    });

    const item = Array.from(container.querySelectorAll<HTMLElement>('[draggable="true"]')).find(
      (el) => el.textContent?.includes('LED'),
    )!;
    await act(async () => {
      item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onAdd).toHaveBeenCalledWith('core/led@1');

    await act(async () => root.unmount());
  });
});
