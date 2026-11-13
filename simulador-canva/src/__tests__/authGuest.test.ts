// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authStore } from '../stores/authStore';
import { exportCircuit } from '../services/api';
import { projectStore } from '../stores/projectStore';
import { getStoredToken, isGuestMode, saveToken } from '../services/session';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

const createdBody = (id: string, slug: string) => ({
    id,
    shareSlug: slug,
    shareUrl: `http://localhost:5173/share/${slug}`,
    title: 'Guardado',
    circuitData: {},
    code: '// code',
    isPublic: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
});

describe('authStore — modo invitado (plantillas en equipos compartidos)', () => {
    beforeEach(() => {
        authStore.logout();
        projectStore.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        authStore.logout();
        projectStore.clear();
    });

    it('useGuestSession no valida el token guardado (cero llamadas a /auth/me)', async () => {
        saveToken('jwt-viejo');
        authStore.useGuestSession();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await authStore.hydrate();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(authStore.getState().status).toBe('idle');
        expect(isGuestMode()).toBe(true);
        expect(getStoredToken()).toBeNull();
    });

    it('en modo invitado, guardar no envía Authorization (proyecto anónimo)', async () => {
        saveToken('jwt-viejo');
        authStore.useGuestSession();

        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, createdBody('anon', 'anon01')));
        vi.stubGlobal('fetch', fetchMock);

        await exportCircuit({ title: 'Invitado' });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
        expect(url).toMatch(/\/projects$/);
        expect(init?.method).toBe('POST');
        expect(((init?.headers ?? {}) as Record<string, string>).Authorization).toBeUndefined();
    });

    it('usePersistedSession recupera explícitamente la cuenta guardada', async () => {
        saveToken('jwt-ok');
        authStore.useGuestSession();
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse(200, { id: 'u1', email: 'profe@demo.com', name: 'Profe', role: 'TEACHER' }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await authStore.usePersistedSession();

        expect(authStore.getState().status).toBe('authenticated');
        expect(authStore.getState().user?.email).toBe('profe@demo.com');
        expect(isGuestMode()).toBe(false);
        expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/me$/);
    });

    it('iniciar sesión desde el modo invitado usa y guarda el token nuevo', async () => {
        authStore.useGuestSession();
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { access_token: 'jwt-nuevo' }))
            .mockResolvedValueOnce(
                jsonResponse(200, { id: 'u2', email: 'a@b.com', name: 'Ana', role: 'STUDENT' }),
            );
        vi.stubGlobal('fetch', fetchMock);

        await authStore.login('a@b.com', 'password123');

        expect(authStore.getState().status).toBe('authenticated');
        expect(isGuestMode()).toBe(false);
        expect(getStoredToken()).toBe('jwt-nuevo');
    });

    it('logout elimina el token guardado de sessionStorage', () => {
        saveToken('jwt-para-borrar');
        authStore.logout();

        expect(getStoredToken()).toBeNull();
        expect(sessionStorage.getItem('simulador.session.token')).toBeNull();
        expect(authStore.getState().status).toBe('idle');
    });
});
