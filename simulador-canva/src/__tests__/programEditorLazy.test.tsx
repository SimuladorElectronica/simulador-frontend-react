// @vitest-environment jsdom
/**
 * Criterio de aceptación: carga diferida.
 * Monaco NO se descarga/renderiza hasta que el usuario abre el editor.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { sidebarStore } from '../stores/sidebarStore';

// Mock de @monaco-editor/react: registra cuántas veces se renderiza
// el Editor real y con qué lenguaje. Así el test NO descarga Monaco.
const editorRenders: Array<Record<string, unknown>> = [];
vi.mock('@monaco-editor/react', () => ({
  default: function MockEditor(props: Record<string, unknown>) {
    editorRenders.push(props);
    // Simula el onMount que hace el componente real (registro de soporte)
    (props.onMount as ((e: unknown, m: unknown) => void) | undefined)?.(
      {},
      { languages: { registerCompletionItemProvider: () => ({ dispose: () => {} }) } },
    );
    return null;
  },
}));

import { ProgramEditor, DEFAULT_SKETCH } from '../UIcomponents/ProgramEditor';

async function waitForEditor(timeoutMs = 2000) {
  const start = Date.now();
  while (editorRenders.length === 0 && Date.now() - start < timeoutMs) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
}

describe('ProgramEditor: carga diferida de Monaco', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    editorRenders.length = 0;
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

  it('al montar NO renderiza el editor: solo el botón "Abrir editor"', async () => {
    await act(async () => {
      root.render(<ProgramEditor />);
    });
    expect(editorRenders).toHaveLength(0); // Monaco no descargado
    expect(container.textContent).toContain('Abrir editor de código');
    expect(container.textContent).not.toContain('Cargando editor');
    await act(async () => root.unmount());
  });

  it('al abrir, carga el editor con lenguaje cpp (C++ exclusivo) y el sketch por defecto', async () => {
    await act(async () => {
      root.render(<ProgramEditor />);
    });
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toContain('Abrir editor');

    await act(async () => {
      btn.click();
    });
    // Espera a que el lazy (~import('./CodeEditor')) resuelva
    await waitForEditor();

    expect(editorRenders.length).toBeGreaterThan(0);
    expect(editorRenders[0].language).toBe('cpp'); // resaltado C++ exclusivo
    expect(editorRenders[0].value).toBe(DEFAULT_SKETCH);
    expect(container.textContent).toContain('Cerrar editor');
    await act(async () => root.unmount());
  });

  it('cerrar oculta el editor sin perder el sketch cargado en el documento', async () => {
    await act(async () => {
      root.render(<ProgramEditor />);
    });
    await act(async () => {
      container.querySelector('button')!.click();
    });
    await waitForEditor();
    expect(editorRenders.length).toBeGreaterThan(0);

    const closeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cerrar editor'),
    )!;
    await act(async () => {
      closeBtn.click();
    });
    expect(container.textContent).toContain('Abrir editor de código');
    // El sketch por defecto sigue disponible al reabrir
    const before = editorRenders.length;
    await act(async () => {
      container.querySelector('button')!.click();
    });
    const start = Date.now();
    while (editorRenders.length === before && Date.now() - start < 2000) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
    }
    const last = editorRenders[editorRenders.length - 1];
    expect(last.value).toBe(DEFAULT_SKETCH);
    await act(async () => root.unmount());
  });
});
