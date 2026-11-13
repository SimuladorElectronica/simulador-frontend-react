/**
 * Cliente HTTP de las PLANTILLAS del simulador (backend-core-nestjs).
 *
 * Una plantilla es un Project marcado con `isTemplate = true`. El backend
 * las expone SIN sesión por dos endpoints de solo lectura:
 *
 *   GET /projects/templates        → listado [{ id, slug, title, description, updatedAt }]
 *   GET /projects/templates/:slug  → detalle con circuitData y code
 *
 * Reglas del contrato:
 * - Ninguna llamada envía Authorization (son públicas).
 * - Un slug inexistente o un proyecto que no es plantilla responde 404;
 *   la UI lo muestra como "no existe una plantilla" sin revelar si el
 *   proyecto existe pero no es plantilla.
 * - El original NUNCA se modifica: quien abre una plantilla trabaja sobre
 *   una copia local en memoria; al guardar se crea un proyecto NUEVO
 *   (fork a nombre del usuario), nunca un PUT sobre la plantilla.
 *
 * URL base: `VITE_API_URL` (default http://localhost:3000), igual que api.ts.
 * El backend mapea `shareSlug` → `slug` en sus vistas de plantilla.
 */
import { ApiError } from './api';

const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface TemplateSummary {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    updatedAt: string;
}

export interface TemplateProject extends TemplateSummary {
    circuitData: unknown;
    code: string;
    createdAt?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

async function parseTemplateError(response: Response): Promise<ApiError> {
    let message = `Error ${response.status} del backend`;
    try {
        const body = (await response.json()) as { message?: string | string[] };
        const raw = body?.message;
        message = (Array.isArray(raw) ? raw.join(' · ') : raw) || message;
    } catch {
        message = `Error ${response.status} al hablar con el backend (${API_URL})`;
    }
    return new ApiError(message, response.status);
}

/** GET público: nunca adjunta Authorization; envuelve fallos de red en ApiError(0). */
async function fetchTemplateEndpoint(path: string): Promise<Response> {
    try {
        return await fetch(`${API_URL}${path}`);
    } catch {
        throw new ApiError(
            `No se pudo hablar con el backend (${API_URL}). Verificá tu conexión e intentá de nuevo.`,
            0,
        );
    }
}

function normalizeSummary(raw: Record<string, unknown>, fallbackSlug: string): TemplateSummary {
    return {
        id: typeof raw.id === 'string' ? raw.id : '',
        slug: typeof raw.slug === 'string' && raw.slug !== '' ? raw.slug : fallbackSlug,
        title:
            typeof raw.title === 'string' && raw.title.trim() !== ''
                ? raw.title.trim()
                : 'Plantilla sin título',
        description: typeof raw.description === 'string' ? raw.description : null,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    };
}

/**
 * GET /projects/templates → catálogo público. Sin sesión.
 * Lanza ApiError con mensaje legible si el backend no responde o falla.
 */
export async function listTemplates(): Promise<TemplateSummary[]> {
    const response = await fetchTemplateEndpoint('/projects/templates');
    if (!response.ok) throw await parseTemplateError(response);

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
        throw new ApiError('El backend devolvió un listado de plantillas con formato inválido.', response.status);
    }
    return data
        .filter(isRecord)
        .map((item) => normalizeSummary(item, ''))
        .filter((item) => item.id !== '' && item.slug !== '');
}

/**
 * GET /projects/templates/:slug → detalle público. Sin sesión.
 * 404 (plantilla inexistente o no marcada como tal) con mensaje claro.
 */
export async function fetchTemplateBySlug(slug: string): Promise<TemplateProject> {
    const response = await fetchTemplateEndpoint(`/projects/templates/${encodeURIComponent(slug)}`);

    if (response.status === 404) {
        throw new ApiError('No existe una plantilla con ese enlace (o no es una plantilla pública).', 404);
    }
    if (!response.ok) throw await parseTemplateError(response);

    const data = (await response.json()) as unknown;
    if (!isRecord(data)) {
        throw new ApiError('El backend devolvió una plantilla con formato inválido.', response.status);
    }
    return {
        ...normalizeSummary(data, slug),
        circuitData: data.circuitData,
        code: typeof data.code === 'string' ? data.code : '',
        ...(typeof data.createdAt === 'string' ? { createdAt: data.createdAt } : {}),
    };
}
