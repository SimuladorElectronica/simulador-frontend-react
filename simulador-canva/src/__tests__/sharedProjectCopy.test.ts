// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportCircuit, loadProjectBySlug } from '../services/api';
import { projectStore } from '../stores/projectStore';
import { clearStoredToken, saveToken } from '../services/session';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

const sharedBody = {
    id: 'uuid-shared',
    shareSlug: 'abc123',
    title: 'Entrega de la guía 1',
    description: null,
    circuitData: {
        formatVersion: 1,
        components: [],
        wires: [],
        programs: [],
        meta: { name: 'Entrega de la guía 1', createdAt: 1, updatedAt: 1 },
    },
    code: '// starter',
    isPublic: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
};

const createdBody = {
    id: 'uuid-copy',
    shareSlug: 'copy01',
    shareUrl: 'http://localhost:5173/share/copy01',
    title: 'Copia de la entrega',
    circuitData: {},
    code: '// code',
    isPublic: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('loadProjectBySlug (/p/:slug) — el circuito compartido es una COPIA', () => {
    beforeEach(() => {
        localStorage.clear();
        projectStore.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearStoredToken();
        projectStore.clear();
    });

    it('no recuerda el proyecto abierto: guardar crea uno NUEVO a nombre del usuario', async () => {
        saveToken('jwt-profe');
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, sharedBody))
            .mockResolvedValueOnce(jsonResponse(201, createdBody));
        vi.stubGlobal('fetch', fetchMock);

        const project = await loadProjectBySlug('abc123');
        expect(project.shareSlug).toBe('abc123');
        // A diferencia de una edición, abrir /p/:slug no deja un proyecto "actual"
        expect(projectStore.get()).toBeNull();

        const saved = await exportCircuit({ title: 'Copia de la entrega' });

        expect(saved.updated).toBe(false);
        const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit | undefined];
        expect(url).toMatch(/\/projects$/);
        expect(init?.method).toBe('POST');
        // La copia queda a nombre del usuario con sesión
        expect(((init?.headers ?? {}) as Record<string, string>).Authorization).toBe('Bearer jwt-profe');
        // El original (uuid-shared) nunca recibe un PUT
        expect(url).not.toContain('uuid-shared');
    });

    it('sin sesión también crea un proyecto nuevo (anónimo), sin Authorization', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, sharedBody))
            .mockResolvedValueOnce(jsonResponse(201, createdBody));
        vi.stubGlobal('fetch', fetchMock);

        await loadProjectBySlug('abc123');
        const saved = await exportCircuit({ title: 'Copia anónima' });

        expect(saved.updated).toBe(false);
        const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit | undefined];
        expect(url).toMatch(/\/projects$/);
        expect(init?.method).toBe('POST');
        expect(((init?.headers ?? {}) as Record<string, string>).Authorization).toBeUndefined();
    });
});
