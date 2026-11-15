// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TemplateBadge } from '../components/TemplateBadge';
import { templateStore } from '../stores/templateStore';

describe('TemplateBadge (indicador discreto de plantilla activa)', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        templateStore.clear();
    });

    it('no renderiza nada sin plantilla activa y muestra el título con ella', async () => {
        await act(async () => {
            root.render(<TemplateBadge />);
        });
        expect(container.textContent).toBe('');

        act(() => {
            templateStore.set({ slug: 'abc123', title: 'Blink con botón' });
        });
        expect(container.textContent).toContain('Plantilla: Blink con botón');
        expect(container.textContent).toContain('el original no se modifica');

        act(() => {
            templateStore.clear();
        });
        expect(container.textContent).toBe('');
    });
});
