// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportCircuit, normalizeCircuitDocument } from '../services/api';
import { listTemplates, fetchTemplateBySlug } from '../services/templates';
import { projectStore } from '../stores/projectStore';
import { saveToken, clearStoredToken } from '../services/session';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { templateStore } from '../stores/templateStore';

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
        updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
        id: 'tpl-2',
        slug: 'def456',
        title: 'Semáforo',
        description: null,
        updatedAt: '2026-10-02T00:00:00.000Z',
    },
];

const templateDetailBody = {
    id: 'tpl-1',
    slug: 'abc123',
    title: 'Blink con botón',
    description: 'Un LED y un pulsador',
    circuitData: {
        formatVersion: 1,
        components: [],
        wires: [],
        programs: [],
        meta: { name: 'Blink con botón', createdAt: 1, updatedAt: 1 },
    },
    code: 'void setup() {}',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
};

const createdBody = (id: string, slug: string) => ({
    id,
    shareSlug: slug,
    shareUrl: `http://localhost:5173/share/${slug}`,
    title: 'Copia de plantilla',
    circuitData: {},
    code: '// code',
    isPublic: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
});

describe('listTemplates (GET /projects/templates, público)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        clearStoredToken();
    });

    it('devuelve el listado normalizado sin enviar Authorization aunque haya token', async () => {
        saveToken('token-de-prueba');
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, templateListBody));
        vi.stubGlobal('fetch', fetchMock);

        const templates = await listTemplates();

        expect(templates).toHaveLength(2);
        expect(templates[0]).toMatchObject({ id: 'tpl-1', slug: 'abc123', title: 'Blink con botón' });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
        expect(url).toMatch(/\/projects\/templates$/);
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
    });

    it('descarta entradas sin id ni slug y tolera descripciones nulas', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                jsonResponse(200, [...templateListBody, { id: '', slug: '', title: 'rota' }, 'basura']),
            ),
        );

        const templates = await listTemplates();
        expect(templates).toHaveLength(2);
        expect(templates[1].description).toBeNull();
    });

    it('backend caído: ApiError de red con mensaje claro (status 0)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

        await expect(listTemplates()).rejects.toMatchObject({
            name: 'ApiError',
            status: 0,
        });
        await expect(listTemplates()).rejects.toThrow(/No se pudo hablar con el backend/);
    });

    it('error 500 del backend: ApiError con el mensaje del cuerpo', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(jsonResponse(500, { message: 'error interno' })),
        );

        await expect(listTemplates()).rejects.toMatchObject({ name: 'ApiError', status: 500 });
    });
});

describe('fetchTemplateBySlug (GET /projects/templates/:slug, público)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        clearStoredToken();
    });

    it('devuelve la plantilla completa sin enviar Authorization', async () => {
        saveToken('token-de-prueba');
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, templateDetailBody));
        vi.stubGlobal('fetch', fetchMock);

        const template = await fetchTemplateBySlug('abc123');

        expect(template.slug).toBe('abc123');
        expect(template.circuitData).toMatchObject({ formatVersion: 1 });
        expect(template.code).toBe('void setup() {}');
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
        expect(url).toMatch(/\/projects\/templates\/abc123$/);
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
    });

    it('escapa caracteres especiales en el slug', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { message: 'no existe' }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(fetchTemplateBySlug('a/b?c')).rejects.toMatchObject({ status: 404 });
        const [url] = fetchMock.mock.calls[0] as [string];
        expect(url).toContain('/projects/templates/a%2Fb%3Fc');
    });

    it('404 (no existe o no es plantilla): ApiError con status 404 y mensaje claro', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(jsonResponse(404, { message: 'no existe una plantilla con el enlace' })),
        );

        await expect(fetchTemplateBySlug('zzz999')).rejects.toMatchObject({
            name: 'ApiError',
            status: 404,
        });
        await expect(fetchTemplateBySlug('zzz999')).rejects.toThrow(/No existe una plantilla/);
    });

    it('red caída: ApiError con status 0', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

        await expect(fetchTemplateBySlug('abc123')).rejects.toMatchObject({
            name: 'ApiError',
            status: 0,
        });
    });
});

// La carga de una plantilla restaura el circuito en el lienzo respetando el
// formatVersion y deja el guardado como fork (el original nunca se modifica).
describe('pipeline de carga de plantilla (lo que hace la ruta /plantillas/:slug)', () => {
    beforeEach(() => {
        ManifestRegistry.init();
        localStorage.clear();
        projectStore.clear();
        templateStore.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        projectStore.clear();
        templateStore.clear();
    });

    it('copia editable en memoria: formato respetado, estado de plantilla fijado y proyecto recordado olvidado', async () => {
        // Un proyecto recordado de antes (p. ej. el último que el usuario abrió)
        projectStore.set({ id: 'tpl-1', shareSlug: 'abc123' });

        const circuitData = {
            formatVersion: 1,
            components: [
                { id: 'microcontroladores_1', type: 'core/esp32@1', position: { x: 10, y: 10 }, params: {} },
                { id: 'salidas_2', type: 'core/led@1', position: { x: 240, y: 300 }, params: { color: '#e74c3c' } },
            ],
            wires: [
                { id: 'wire_1', from: { componentId: 'microcontroladores_1', pinId: 'gpio2' }, to: { componentId: 'salidas_2', pinId: 'anode' }, color: '#e74c3c' },
            ],
            programs: [
                { mcuComponentId: 'microcontroladores_1', language: 'cpp-subset', languageVersion: '1.0.0', source: 'void setup() {}' },
            ],
            meta: { name: 'Blink con botón', createdAt: 1, updatedAt: 1 },
        };
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(jsonResponse(200, { ...templateDetailBody, circuitData })),
        );

        const template = await fetchTemplateBySlug('abc123');
        // Mismo camino que App: normalizar → reemplazar documento → olvidar proyecto → fijar plantilla
        const normalized = normalizeCircuitDocument(template.circuitData, template.title);
        documentStore.replaceDocument(normalized);
        projectStore.clear();
        templateStore.set({ slug: template.slug, title: template.title });

        const snap = documentStore.getSnapshot();
        expect(snap.formatVersion).toBe(1);
        expect(snap.components).toHaveLength(2);
        expect(snap.programs).toHaveLength(1);
        expect(snap.meta.name).toBe('Blink con botón');
        // El guardado posterior será un POST nuevo: nunca un PUT sobre la plantilla
        expect(projectStore.get()).toBeNull();
        expect(templateStore.get()).toEqual({ slug: 'abc123', title: 'Blink con botón' });
        // La copia es independiente del objeto recibido por HTTP
        expect(snap.components[0]).not.toBe(circuitData.components[0]);
    });
});

describe('fork al guardar tras abrir una plantilla', () => {
    beforeEach(() => {
        localStorage.clear();
        projectStore.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearStoredToken();
        projectStore.clear();
    });

    it('aunque haya sesión y un proyecto recordado que se olvidó al cargar la plantilla, el guardado es un POST nuevo', async () => {
        saveToken('token-de-prueba');
        // Simula lo que hace la ruta /plantillas/:slug al cargar: olvidar el
        // proyecto recordado para que el guardado cree uno NUEVO (fork).
        projectStore.set({ id: 'tpl-1', shareSlug: 'abc123' });
        projectStore.clear();

        const fetchMock = vi
            .fn()
            .mockResolvedValue(jsonResponse(201, createdBody('uuid-fork', 'fork22')));
        vi.stubGlobal('fetch', fetchMock);

        const result = await exportCircuit({ title: 'Copia de plantilla' });

        expect(result.updated).toBe(false);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
        expect(url).toMatch(/\/projects$/);
        expect(init?.method).toBe('POST');
        expect(url).not.toContain('tpl-1');
        // El proyecto creado pasa a ser el recordado (los próximos guardados editan el fork)
        expect(projectStore.get()).toEqual({ id: 'uuid-fork', shareSlug: 'fork22' });
    });
});
