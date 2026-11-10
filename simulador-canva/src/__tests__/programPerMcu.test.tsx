// @vitest-environment jsdom
/**
 * Un editor para N ESP32: al seleccionar una placa se muestra su sketch,
 * y "Cargar programa" apunta a la placa seleccionada.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { sidebarStore } from '../stores/sidebarStore';

// Mock de Monaco: registra props recibidas y evita descargar el runtime.
const editorRenders: Array<Record<string, unknown>> = [];
vi.mock('@monaco-editor/react', () => ({
  default: function MockEditor(props: Record<string, unknown>) {
    editorRenders.push(props);
    return null;
  },
}));

import { ProgramEditor } from '../UIcomponents/ProgramEditor';

async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
}

async function select(id: string) {
  await act(async () => {
    programEditorStore.selectMcu(id);
  });
}

const lastEditor = () => editorRenders[editorRenders.length - 1];

describe('Editor por MCU: seleccionar un ESP32 muestra/carga su código', () => {
  let container: HTMLDivElement;
  let root: Root;
  let esp1: { id: string };
  let esp2: { id: string };

  beforeEach(() => {
    editorRenders.length = 0;
    ManifestRegistry.init();
    const doc = documentStore.getDocument();
    doc.components.length = 0;
    doc.wires.length = 0;
    doc.programs.length = 0;
    programEditorStore.reset();
    sidebarStore.setTab('code');

    esp1 = documentStore.addComponent('core/esp32@1', { x: 0, y: 0 });
    esp2 = documentStore.addComponent('core/esp32@1', { x: 200, y: 0 });
    documentStore.setProgram(esp1.id, 'SKETCH_A');

    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it('muestra el sketch del ESP32 seleccionado y el botón lleva su nombre', async () => {
    await select(esp1.id);
    await act(async () => {
      root.render(<ProgramEditor />);
    });
    await waitFor(() => lastEditor()?.value === 'SKETCH_A');

    expect(lastEditor().value).toBe('SKETCH_A');
    // El botón de carga identifica la placa (nombre + id)
    const loadBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cargar programa en'),
    )!;
    expect(loadBtn.textContent).toContain('ESP32 DevKit v1');
    expect(loadBtn.textContent).toContain(esp1.id);

    await act(async () => root.unmount());
  });

  it('un ESP32 sin código NO pisa el contenido y permite cargárselo', async () => {
    await select(esp1.id);
    await act(async () => {
      root.render(<ProgramEditor />);
    });
    await waitFor(() => lastEditor()?.value === 'SKETCH_A');

    // Cambiar a la segunda placa (sin programa): el contenido se conserva
    await select(esp2.id);
    await waitFor(() => container.textContent?.includes(esp2.id) ?? false);
    expect(lastEditor().value).toBe('SKETCH_A');

    // El usuario edita sobre ese contenido y lo carga en esp2
    await act(async () => {
      (lastEditor().onChange as (v: string) => void)('SKETCH_B');
    });
    const loadBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cargar programa en'),
    )!;
    await act(async () => {
      loadBtn.click();
    });

    const programs = documentStore.getDocument().programs;
    expect(programs.find((p) => p.mcuComponentId === esp2.id)?.source).toBe('SKETCH_B');
    // El programa de la primera placa no se modificó
    expect(programs.find((p) => p.mcuComponentId === esp1.id)?.source).toBe('SKETCH_A');

    await act(async () => root.unmount());
  });

  it('volver a seleccionar el primer ESP32 recupera su sketch guardado', async () => {
    await select(esp1.id);
    await act(async () => {
      root.render(<ProgramEditor />);
    });
    await waitFor(() => lastEditor()?.value === 'SKETCH_A');

    await select(esp2.id); // sin programa
    await act(async () => {
      (lastEditor().onChange as (v: string) => void)('SKETCH_B');
    });
    // Sin cargar, volvemos a esp1: se muestra su código guardado
    await select(esp1.id);
    await waitFor(() => lastEditor()?.value === 'SKETCH_A');
    expect(lastEditor().value).toBe('SKETCH_A');

    await act(async () => root.unmount());
  });
});
