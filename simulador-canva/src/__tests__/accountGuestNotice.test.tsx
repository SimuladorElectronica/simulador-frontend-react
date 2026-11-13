// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AccountPanel } from '../UIcomponents/AccountPanel';
import { authStore } from '../stores/authStore';
import { clearStoredToken, hasStoredToken, saveToken } from '../services/session';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((button) =>
        (button.textContent ?? '').includes(label),
    );
}

describe('AccountPanel — modo invitado con sesión guardada', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        authStore.logout();
        (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
        authStore.logout();
        clearStoredToken();
    });

    it('no usa el token guardado y ofrece "Usar esa cuenta" o "Cerrar sesión"', async () => {
        saveToken('jwt-guardado');
        act(() => {
            authStore.useGuestSession();
        });

        await act(async () => {
            root.render(<AccountPanel />);
        });

        expect(container.textContent).toContain('Modo invitado');
        expect(findButton(container, 'Usar esa cuenta')).toBeTruthy();
        expect(findButton(container, 'Cerrar sesión')).toBeTruthy();
        // El token sigue guardado (no se usa, pero tampoco se borra solo)
        expect(hasStoredToken()).toBe(true);
    });

    it('"Usar esa cuenta" valida el token y muestra la cuenta', async () => {
        saveToken('jwt-guardado');
        act(() => {
            authStore.useGuestSession();
        });
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse(200, { id: 'u1', email: 'profe@demo.com', name: 'Profe', role: 'TEACHER' }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await act(async () => {
            root.render(<AccountPanel />);
        });

        await act(async () => {
            findButton(container, 'Usar esa cuenta')!.click();
            await authStore.usePersistedSession();
        });

        expect(authStore.getState().status).toBe('authenticated');
        expect(container.textContent).toContain('profe@demo.com');
        expect(container.textContent).not.toContain('Modo invitado');
    });

    it('"Cerrar sesión" descarta la sesión guardada sin usarla', async () => {
        saveToken('jwt-guardado');
        act(() => {
            authStore.useGuestSession();
        });

        await act(async () => {
            root.render(<AccountPanel />);
        });

        await act(async () => {
            findButton(container, 'Cerrar sesión')!.click();
        });

        expect(hasStoredToken()).toBe(false);
        expect(container.textContent).not.toContain('Modo invitado');
    });
});
