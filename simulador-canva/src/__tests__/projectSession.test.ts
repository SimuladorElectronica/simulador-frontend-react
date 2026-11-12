// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { projectStore } from '../stores/projectStore';
import { ApiError, exportCircuit, apiLogin } from '../services/api';
import { saveToken, clearStoredToken } from '../services/session';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

const savedProjectBody = (id: string, slug: string) => ({
    id,
    shareSlug: slug,
    shareUrl: `http://localhost:5173/share/${slug}`,
    title: 'Circuito de prueba',
    circuitData: {},
    code: '// code',
    isPublic: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('projectStore (referencia al proyecto guardado)', () => {
    beforeEach(() => {
        localStorage.clear();
        projectStore.clear();
    });

    it('set/get/clear y persistencia en localStorage', () => {
        expect(projectStore.get()).toBeNull();
        projectStore.set({ id: 'uuid-1', shareSlug: 'abc123' });
        expect(projectStore.get()).toEqual({ id: 'uuid-1', shareSlug: 'abc123' });
        expect(JSON.parse(localStorage.getItem('simulador.project')!)).toEqual({
            id: 'uuid-1',
            shareSlug: 'abc123',
        });
        projectStore.clear();
        expect(projectStore.get()).toBeNull();
        expect(localStorage.getItem('simulador.project')).toBeNull();
    });
});

describe('exportCircuit (crear vs. editar el MISMO proyecto)', () => {
    beforeEach(() => {
        localStorage.clear();
        projectStore.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearStoredToken();
        projectStore.clear();
    });

    it('primer guardado: POST /projects; segundo: PUT /projects/:id (sin duplicar)', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(201, savedProjectBody('uuid-1', 'abc123')))
            .mockResolvedValueOnce(jsonResponse(200, savedProjectBody('uuid-1', 'abc123')));
        vi.stubGlobal('fetch', fetchMock);

        const first = await exportCircuit({ title: 'Prueba' });
        expect(first.updated).toBe(false);
        expect(first.shareSlug).toBe('abc123');

        const second = await exportCircuit({ title: 'Prueba' });
        expect(second.updated).toBe(true);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [url1, init1] = fetchMock.mock.calls[0];
        const [url2, init2] = fetchMock.mock.calls[1];
        expect(url1).toMatch(/\/projects$/);
        expect(init1?.method).toBe('POST');
        expect(url2).toMatch(/\/projects\/uuid-1$/);
        expect(init2?.method).toBe('PUT');
    });

    it('adjunta Authorization: Bearer cuando hay token guardado', async () => {
        saveToken('token-de-prueba');
        const fetchMock = vi
            .fn()
            .mockResolvedValue(jsonResponse(201, savedProjectBody('uuid-2', 'def456')));
        vi.stubGlobal('fetch', fetchMock);

        await exportCircuit({ title: 'Con sesión' });
        const headers = (fetchMock.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer token-de-prueba');
    });

    it('forceNew: ignora el proyecto recordado y crea uno nuevo', async () => {
        projectStore.set({ id: 'uuid-9', shareSlug: 'zzz999' });
        const fetchMock = vi
            .fn()
            .mockResolvedValue(jsonResponse(201, savedProjectBody('uuid-3', 'new111')));
        vi.stubGlobal('fetch', fetchMock);

        const result = await exportCircuit({ title: 'Copia', forceNew: true });
        expect(result.updated).toBe(false);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toMatch(/\/projects$/);
        expect(init?.method).toBe('POST');
    });

    it('si el PUT falla con 403, se propaga ApiError con status para que la UI ofrezca copia nueva', async () => {
        saveToken('token-de-otro');
        projectStore.set({ id: 'uuid-ajeno', shareSlug: 'own123' });
        const fetchMock = vi
            .fn()
            .mockResolvedValue(jsonResponse(403, { message: 'No tenés permiso sobre este proyecto' }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(exportCircuit({ title: 'Ajeno' })).rejects.toMatchObject({
            name: 'ApiError',
            status: 403,
        });
    });
});

describe('apiLogin', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('devuelve el access_token ante credenciales válidas', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(jsonResponse(200, { access_token: 'jwt-123' })),
        );
        await expect(apiLogin('a@b.com', 'password123')).resolves.toBe('jwt-123');
    });

    it('lanza ApiError(401) ante credenciales inválidas', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Credenciales inválidas' })),
        );
        await expect(apiLogin('a@b.com', 'mala')).rejects.toBeInstanceOf(ApiError);
    });
});
