// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { TemplatesPage } from '../UIcomponents/TemplatesPage';
import { TemplateBadge } from '../UIcomponents/TemplateBadge';
import { templateStore } from '../stores/templateStore';
import { clearStoredToken, hasStoredToken, saveToken } from '../services/session';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

const templateListBody = [
    {
        id: 'tpl-1',
        slug: 'abc123',
        title: 'Blink con botón',
        description: 'Un LED y un pulsador',
        updatedAt: '2026-10-01T12:00:00.000Z',
    },
    {
        id: 'tpl-2',
        slug: 'def456',
        title: 'Semáforo',
        description: null,
        updatedAt: '2026-10-02T12:00:00.000Z',
    },
];

describe('TemplatesPage (/plantillas)', () => {
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
        vi.unstubAllGlobals();
        clearStoredToken();
    });

    it('lista las plantillas con enlaces a /plantillas/:slug', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, templateListBody)));

        await act(async () => {
            root.render(
                <MemoryRouter initialEntries={['/plantillas']}>
                    <TemplatesPage />
                </MemoryRouter>,
            );
        });

        expect(container.textContent).toContain('Blink con botón');
        expect(container.textContent).toContain('Semáforo');
        expect(container.textContent).toContain('Un LED y un pulsador');
        const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
        expect(hrefs).toContain('/plantillas/abc123');
        expect(hrefs).toContain('/plantillas/def456');
    });

    it('muestra el mensaje de error y un botón de reintento si el backend falla', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

        await act(async () => {
            root.render(
                <MemoryRouter initialEntries={['/plantillas']}>
                    <TemplatesPage />
                </MemoryRouter>,
            );
        });

        expect(container.textContent).toContain('No se pudieron cargar las plantillas');
        expect(container.textContent).toContain('No se pudo hablar con el backend');
        expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.includes('Reintentar'))).toBe(true);
    });

    it('muestra un aviso cuando no hay plantillas publicadas', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [])));

        await act(async () => {
            root.render(
                <MemoryRouter initialEntries={['/plantillas']}>
                    <TemplatesPage />
                </MemoryRouter>,
            );
        });

        expect(container.textContent).toContain('Todavía no hay plantillas publicadas');
    });

    it('muestra "Cerrar sesión" si hay una sesión guardada y la descarta al pulsar', async () => {
        saveToken('jwt-guardado');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [])));

        await act(async () => {
            root.render(
                <MemoryRouter initialEntries={['/plantillas']}>
                    <TemplatesPage />
                </MemoryRouter>,
            );
        });

        const button = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Cerrar sesión'),
        );
        expect(button).toBeTruthy();
        expect(hasStoredToken()).toBe(true);

        await act(async () => {
            button!.click();
        });

        expect(hasStoredToken()).toBe(false);
        expect(container.textContent).not.toContain('Cerrar sesión');
    });

    it('no muestra "Cerrar sesión" si no hay sesión guardada', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [])));

        await act(async () => {
            root.render(
                <MemoryRouter initialEntries={['/plantillas']}>
                    <TemplatesPage />
                </MemoryRouter>,
            );
        });

        expect(container.textContent).not.toContain('Cerrar sesión');
    });
});

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
