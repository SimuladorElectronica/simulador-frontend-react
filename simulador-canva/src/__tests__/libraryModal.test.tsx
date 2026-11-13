// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { sidebarStore } from '../stores/sidebarStore';
import { LibraryModal } from '../UIcomponents/LibraryModal';

// Monaco no se descarga en estos tests (nunca se abre el editor).
vi.mock('@monaco-editor/react', () => ({ default: () => null }));

import { ProgramEditor, DEFAULT_SKETCH } from '../UIcomponents/ProgramEditor';

/** Fija el valor de un input de React y dispara su evento nativo. */
function setNativeValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(container: HTMLElement, label: string | RegExp): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        const text = button.textContent ?? '';
        return typeof label === 'string' ? text.includes(label) : label.test(text);
    });
}

describe('LibraryModal', () => {
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
        vi.unstubAllGlobals();
    });

    it('lista el catálogo curado y la búsqueda filtra', async () => {
        await act(async () => {
            root.render(<LibraryModal onClose={() => undefined} />);
        });

        expect(container.textContent).toContain('LCD 16x2 con I2C');
        expect(container.textContent).toContain('WiFi (ESP32)');
        expect(container.textContent).toContain('MQTT (PubSubClient)');

        const search = container.querySelector(
            'input[aria-label="Buscar librería"]',
        ) as HTMLInputElement;
        await act(async () => setNativeValue(search, 'mqtt'));

        expect(container.textContent).toContain('MQTT (PubSubClient)');
        expect(container.textContent).not.toContain('LCD 16x2 con I2C');
        expect(container.textContent).not.toContain('WiFi (ESP32)');
    });

    it('inserta los includes en el sketch del editor y muestra feedback', async () => {
        await act(async () => {
            root.render(<LibraryModal onClose={() => undefined} />);
        });

        // Seleccionar la LCD (primera de la lista por defecto).
        const insert = findButton(container, 'Insertar #include')!;
        await act(async () => insert.click());

        const source = programEditorStore.getState().source;
        expect(source).toContain('#include <Wire.h>');
        expect(source).toContain('#include <LiquidCrystal_I2C.h>');
        expect(container.textContent).toContain('✓ Insertado');
    });

    it('una segunda inserción avisa que ya estaba incluido', async () => {
        await act(async () => {
            root.render(<LibraryModal onClose={() => undefined} />);
        });

        const insert = findButton(container, 'Insertar #include')!;
        await act(async () => insert.click());
        await act(async () => insert.click());

        const source = programEditorStore.getState().source;
        expect(source.match(/#include <Wire\.h>/g)).toHaveLength(1);
        expect(container.textContent).toContain('Ya estaba incluido');
    });

    it('inserta los dos headers de PubSubClient sin duplicar WiFi.h', async () => {
        await act(async () => {
            root.render(<LibraryModal onClose={() => undefined} />);
        });

        // WiFi primero (un header), después PubSubClient (dos headers)
        await act(async () => {
            findButton(container, 'WiFi (ESP32)')!.click();
        });
        await act(async () => findButton(container, 'Insertar #include')!.click());

        await act(async () => {
            findButton(container, 'MQTT (PubSubClient)')!.click();
        });
        await act(async () => findButton(container, 'Insertar #include')!.click());

        const source = programEditorStore.getState().source;
        expect(source.match(/#include <WiFi\.h>/g)).toHaveLength(1);
        expect(source).toContain('#include <PubSubClient.h>');
    });

    it('“Copiar ejemplo” escribe el ejemplo en el portapapeles', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window.navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });

        await act(async () => {
            root.render(<LibraryModal onClose={() => undefined} />);
        });

        await act(async () => {
            findButton(container, 'Copiar ejemplo')!.click();
        });

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0][0]).toContain('LiquidCrystal_I2C lcd(0x27, 16, 2);');
        expect(container.textContent).toContain('✓ Copiado');
    });

    it('Escape cierra el modal', async () => {
        const onClose = vi.fn();
        await act(async () => {
            root.render(<LibraryModal onClose={onClose} />);
        });

        await act(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clic en el fondo cierra el modal', async () => {
        const onClose = vi.fn();
        await act(async () => {
            root.render(<LibraryModal onClose={onClose} />);
        });

        const backdrop = container.querySelector('[data-testid="library-modal-backdrop"]')!;
        await act(async () => {
            backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

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
