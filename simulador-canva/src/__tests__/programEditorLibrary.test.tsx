// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { sidebarStore } from '../stores/sidebarStore';
import { ProgramEditor, DEFAULT_SKETCH } from '../components/ProgramEditor';

// Monaco no se descarga en estos tests (nunca se abre el editor).
vi.mock('@monaco-editor/react', () => ({ default: () => null }));

function findButton(container: HTMLElement, label: string | RegExp): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        const text = button.textContent ?? '';
        return typeof label === 'string' ? text.includes(label) : label.test(text);
    });
}

describe('ProgramEditor + LibraryModal (integración)', () => {
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

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    it('el botón “📚 Librerías” abre el modal y el sketch se actualiza', async () => {
        await act(async () => {
            root.render(<ProgramEditor />);
        });

        const open = findButton(container, '📚 Librerías')!;
        expect(open).toBeDefined();

        await act(async () => open.click());
        expect(container.querySelector('[role="dialog"]')).not.toBeNull();

        await act(async () => findButton(container, 'WiFi (ESP32)')!.click());
        await act(async () => findButton(container, 'Insertar #include')!.click());

        expect(programEditorStore.getState().source).toContain('#include <WiFi.h>');
        expect(programEditorStore.getState().source).not.toBe(DEFAULT_SKETCH);

        // El editor guionado sigue usable: el modal se cierra con Escape.
        await act(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
});
