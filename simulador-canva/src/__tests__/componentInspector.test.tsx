// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { selectionStore } from '../stores/selectionStore';
import { simulationClient } from '../worker/simulationClient';
import { ComponentInspector } from '../UIcomponents/ComponentInspector';

/** Fija el valor de un input de React y dispara su evento nativo. */
function setNativeValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ComponentInspector (flotante sobre el canvas)', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        ManifestRegistry.init();
        documentStore.getDocument().components.length = 0;
        documentStore.getDocument().wires.length = 0;
        documentStore.getDocument().programs.length = 0;
        selectionStore.setSelection(null);
        (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    const render = async () => {
        await act(async () => {
            root.render(<ComponentInspector />);
        });
    };

    it('no se muestra si no hay componente seleccionado', async () => {
        await render();
        expect(container.querySelector('input')).toBeNull();
        expect(container.textContent).toBe('');
    });

    it('edita un parámetro configurable y lo persiste en el documento', async () => {
        const instance = documentStore.addComponent('core/resistor@1', { x: 0, y: 0 });
        selectionStore.setSelection({ kind: 'component', id: instance.id });
        await render();

        expect(container.textContent).toContain('Resistencia');

        const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
        expect(input).not.toBeNull();
        expect(input.value).toBe('220');

        await act(async () => {
            setNativeValue(input, '470');
        });

        expect(documentStore.getComponent(instance.id)!.params.resistance).toBe(470);
    });

    it('las interacciones envían INTERACT al Worker (sliders de sensores)', async () => {
        const instance = documentStore.addComponent('core/ldr@1', { x: 0, y: 0 });
        selectionStore.setSelection({ kind: 'component', id: instance.id });

        const interact = vi.spyOn(simulationClient, 'interact').mockImplementation(() => undefined);
        await render();

        const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
        expect(slider).not.toBeNull();
        // Valor sembrado por `defaultValue` de la interacción
        expect(slider.value).toBe('60');

        await act(async () => {
            setNativeValue(slider, '80');
        });

        expect(interact).toHaveBeenCalledWith(instance.id, 'light', 80);
        interact.mockRestore();
    });

    it('muestra el estado en vivo que publica el Worker', async () => {
        const instance = documentStore.addComponent('core/led@1', { x: 0, y: 0 });
        selectionStore.setSelection({ kind: 'component', id: instance.id });
        await render();

        expect(container.textContent).toContain('Estado en vivo');
        expect(container.textContent).toContain('brightness');
        // Sin SNAPSHOT todavía: el observable queda sin valor
        expect(container.textContent).toContain('—');
    });
});
