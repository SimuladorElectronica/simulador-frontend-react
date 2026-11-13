import type {
    CircuitDocument,
    ComponentInstance,
    PinReference,
    ProgramDocument,
    Wire,
} from '@types';
import { documentStore } from '../stores/documentStore';
import { projectStore } from '../stores/projectStore';
import { getStoredToken } from './session';

/**
 * Cliente HTTP del backend (NestJS, ver backend-core-nestjs).
 *
 * El backend guarda el circuito como `circuitData` (JSONB): ahí viaja el
 * `CircuitDocument` COMPLETO (incluidos los programs: un circuito puede
 * tener varios ESP32, cada uno con su sketch). El campo `code`, obligatorio
 * en el DTO, se rellena con los fuentes concatenados (un encabezado por MCU)
 * solo para cumplir el contrato y permitir ver el código desde la API.
 */
const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface CreateProjectResponse {
    id: string;
    shareSlug: string;
    /** URL que genera el backend (usa `FRONTEND_URL`; por defecto /share/{slug}) */
    shareUrl: string;
    title: string;
    circuitData: unknown;
    code: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectPublicView {
    id: string;
    shareSlug: string;
    title: string;
    description: string | null;
    circuitData: unknown;
    code: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ExportOptions {
    title?: string;
    description?: string;
    isPublic?: boolean;
    /** Ignora el proyecto recordado y crea uno nuevo (fuerza POST). */
    forceNew?: boolean;
}

/** Resultado unificado de guardar (crear o editar) un circuito. */
export interface SavedProject {
    id: string;
    shareSlug: string;
    shareUrl: string;
    title: string;
    /** true si se editó el proyecto existente (PUT); false si se creó (POST). */
    updated: boolean;
}

// ---------------------------------------------------------------------------
// Serialización / normalización del documento
// ---------------------------------------------------------------------------

/** Texto C++ que se envía como `code` (un bloque por MCU presente). */
export function buildShareCode(doc: CircuitDocument): string {
    if (doc.programs.length === 0) return '// Circuito sin programas C++';
    return doc.programs
        .map((p) => `// ===== MCU: ${p.mcuComponentId} =====\n${p.source}`)
        .join('\n\n');
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

function normalizePinRef(v: unknown): PinReference | null {
    if (!isRecord(v)) return null;
    const { componentId, pinId } = v;
    if (typeof componentId !== 'string' || typeof pinId !== 'string') return null;
    return { componentId, pinId };
}

/**
 * Convierte el `circuitData` (JSONB) del backend en un `CircuitDocument`
 * seguro para cargar: descarta cables que referencian componentes
 * inexistentes y programas cuyo MCU no existe (el worker reportaría
 * PROGRAM_ERROR en cada LOAD_CIRCUIT). Lanza Error si no es un objeto.
 */
export function normalizeCircuitDocument(
    raw: unknown,
    fallbackName = 'Circuito compartido',
): CircuitDocument {
    if (!isRecord(raw)) {
        throw new Error('El backend devolvió un circuito con formato inválido.');
    }

    const components: ComponentInstance[] = (Array.isArray(raw.components) ? raw.components : [])
        .filter(isRecord)
        .map((c, i) => ({
            id: typeof c.id === 'string' && c.id !== '' ? c.id : `comp_${i + 1}`,
            type: typeof c.type === 'string' ? c.type : 'unknown',
            position:
                isRecord(c.position) &&
                typeof c.position.x === 'number' &&
                typeof c.position.y === 'number'
                    ? { x: c.position.x, y: c.position.y }
                    : { x: 0, y: 0 },
            params: isRecord(c.params)
                ? (c.params as Record<string, number | string | boolean>)
                : {},
            ...(typeof c.label === 'string' ? { label: c.label } : {}),
        }));

    const componentIds = new Set(components.map((c) => c.id));

    const wires: Wire[] = (Array.isArray(raw.wires) ? raw.wires : [])
        .filter(isRecord)
        .map((w, i): Wire | null => {
            const from = normalizePinRef(w.from);
            const to = normalizePinRef(w.to);
            if (!from || !to) return null;
            if (!componentIds.has(from.componentId) || !componentIds.has(to.componentId)) return null;
            return {
                id: typeof w.id === 'string' && w.id !== '' ? w.id : `wire_${i + 1}`,
                from,
                to,
                color: typeof w.color === 'string' ? w.color : '#e74c3c',
            };
        })
        .filter((w): w is Wire => w !== null);

    const programs: ProgramDocument[] = (Array.isArray(raw.programs) ? raw.programs : [])
        .filter(isRecord)
        .filter(
            (p) =>
                typeof p.mcuComponentId === 'string' &&
                componentIds.has(p.mcuComponentId) &&
                typeof p.source === 'string',
        )
        .map((p) => ({
            mcuComponentId: p.mcuComponentId as string,
            language: 'cpp-subset',
            languageVersion: typeof p.languageVersion === 'string' ? p.languageVersion : '1.0.0',
            source: p.source as string,
        }));

    const metaRaw = isRecord(raw.meta) ? raw.meta : {};
    const meta = {
        name: typeof metaRaw.name === 'string' && metaRaw.name !== '' ? metaRaw.name : fallbackName,
        createdAt: typeof metaRaw.createdAt === 'number' ? metaRaw.createdAt : Date.now(),
        updatedAt: Date.now(),
    };

    return {
        formatVersion: typeof raw.formatVersion === 'number' ? raw.formatVersion : 1,
        components,
        wires,
        programs,
        meta,
        ...(Array.isArray(raw.embeddedManifests) ? { embeddedManifests: raw.embeddedManifests } : {}),
    };
}

// ---------------------------------------------------------------------------
// Llamadas HTTP
// ---------------------------------------------------------------------------

/** Error de la API con el status HTTP, para que la UI decida el fallback. */
export class ApiError extends Error {
    public readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function parseError(response: Response): Promise<ApiError> {
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

/** Headers JSON + Authorization si hay token guardado. */
function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

/**
 * Guarda el circuito actual en el backend.
 *
 * - Si hay un proyecto recordado en `projectStore` (y no se pide `forceNew`):
 *   edita ESE MISMO proyecto (PUT /projects/:id) en lugar de crear uno nuevo.
 * - Los circuitos abiertos desde /p/:slug o /plantillas/:slug son COPIA: no
 *   se recuerda el proyecto, así que el primer guardado siempre es un POST
 *   (fork) y el original compartido/plantilla nunca recibe un PUT.
 * - Si no hay token, el PUT falla con 401 (el backend exige JWT para editar):
 *   la UI lo detecta vía `ApiError.status === 401` y ofrece "Guardar como
 *   proyecto nuevo" o iniciar sesión.
 * - Si el proyecto era de otro dueño (403) o desapareció (404): mismo patrón.
 *
 * Anónimo por defecto: sin token, POST /projects crea un proyecto anónimo
 * (los anónimos son de solo lectura según el backend).
 */
export async function exportCircuit(options: ExportOptions = {}): Promise<SavedProject> {
    const doc = documentStore.getSnapshot();
    const effectiveTitle = options.title?.trim() || doc.meta.name || 'Circuito sin título';
    const payload = {
        title: effectiveTitle,
        ...(options.description?.trim() ? { description: options.description.trim() } : {}),
        circuitData: { ...doc, meta: { ...doc.meta, name: effectiveTitle } },
        code: buildShareCode(doc),
        isPublic: options.isPublic ?? true,
    };

    const existing = options.forceNew ? null : projectStore.get();
    const url = existing ? `${API_URL}/projects/${existing.id}` : `${API_URL}/projects`;

    const response = await fetch(url, {
        method: existing ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) throw await parseError(response);

    const data = (await response.json()) as CreateProjectResponse | ProjectPublicView & {
        shareUrl: string;
    };
    projectStore.set({ id: data.id, shareSlug: data.shareSlug });

    return {
        id: data.id,
        shareSlug: data.shareSlug,
        shareUrl: data.shareUrl ?? `${window.location.origin}/p/${data.shareSlug}`,
        title: data.title,
        updated: existing !== null,
    };
}

/** POST /auth/login → access_token (Bearer) */
export async function apiLogin(email: string, password: string): Promise<string> {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw await parseError(response);
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
}

/** GET /auth/me con el token guardado. Lanza ApiError(401) si venció/es inválido. */
export async function apiFetchMe(): Promise<{ id: string; email: string; name: string; role: string }> {
    const response = await fetch(`${API_URL}/auth/me`, {
        headers: authHeaders(),
    });

    if (!response.ok) throw await parseError(response);
    return (await response.json()) as { id: string; email: string; name: string; role: string };
}

/**
 * Busca un circuito por su shareSlug (6 caracteres). Lanza Error con un
 * mensaje legible si no existe o es privado (el backend responde 404).
 *
 * El proyecto abierto se trata SIEMPRE como una COPIA: no se recuerda en
 * projectStore, así que guardar crea un proyecto NUEVO (fork) en lugar de
 * editar el original compartido (entregas, starters de guía, etc.).
 */
export async function loadProjectBySlug(slug: string): Promise<ProjectPublicView> {
    const response = await fetch(`${API_URL}/projects/${encodeURIComponent(slug)}`);

    if (response.status === 404) {
        throw new ApiError('No existe un circuito público con ese enlace (o es privado).', 404);
    }
    if (!response.ok) throw await parseError(response);
    return (await response.json()) as ProjectPublicView;
}
