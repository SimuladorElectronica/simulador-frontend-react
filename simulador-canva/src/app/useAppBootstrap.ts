import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDocument } from '../components/hooks/useDocument';
import { documentStore } from '../stores/documentStore';
import { projectStore } from '../stores/projectStore';
import { templateStore } from '../stores/templateStore';
import { authStore } from '../stores/authStore';
import { ManifestRegistry } from '../core/registry/manifestRegistry';
import { simulationClient } from '../worker/simulationClient';
import { loadProjectBySlug } from '../services/api';
import { fetchTemplateBySlug } from '../services/templates';
import { saveToken } from '../services/session';
import { startFreshCircuit } from '../services/freshCircuit';
import { applyProjectToDocument } from './applyProject';

/**
 * Efectos de arranque de la app: /p/:slug, /plantillas/:slug, /session/:token
 * y /new. Devuelve el estado del overlay de carga.
 */
export function useAppBootstrap() {
    const { slug, token: sessionToken } = useParams<{ slug?: string; token?: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const doc = useDocument();
    const isTemplateRoute = location.pathname.startsWith('/plantillas/');
    const loadKey = slug ? `${isTemplateRoute ? 'template' : 'share'}:${slug}` : null;
    const [isLoadingShared, setIsLoadingShared] = useState(() => Boolean(slug));
    const [loadError, setLoadError] = useState<string | null>(null);
    const loadedKeyRef = useRef<string | null>(null);
    const sessionHandledRef = useRef(false);
    const freshHandledRef = useRef(false);

    const wantsFresh =
        location.pathname === '/new' || new URLSearchParams(location.search).get('new') === '1';

    // Enviar el circuito al worker solo cuando cambia la topología
    // (mover componentes en el canvas NO dispara LOAD_CIRCUIT: la proyección
    // excluye posiciones). Al reemplazar el documento se reenvía.
    useEffect(() => {
        if (documentStore.hasTopologyChanged()) {
            simulationClient.loadCircuit(documentStore.getSimulationProjection(), ManifestRegistry.getAll());
        }
    }, [doc]);

    // /new o /…?new=1 → empezar un circuito desde cero (enlace del dashboard).
    useEffect(() => {
        if (!wantsFresh || freshHandledRef.current) return;
        freshHandledRef.current = true;
        const snap = documentStore.getSnapshot();
        const hasWork = snap.components.length + snap.wires.length + snap.programs.length > 0;
        // En una pestaña nueva el lienzo ya está vacío y no se pregunta nada;
        // solo confirmamos si llegaríamos con trabajo sin guardar.
        if (!hasWork || window.confirm('¿Empezar un circuito vacío? Se limpia el lienzo actual.')) {
            startFreshCircuit();
        }
        navigate('/', { replace: true });
    }, [wantsFresh, navigate]);

    // Sesión recibida por URL (/session/:token): guardar, validar y limpiar la URL.
    useEffect(() => {
        if (!sessionToken || sessionHandledRef.current) return;
        sessionHandledRef.current = true;
        saveToken(sessionToken);
        void authStore.hydrate();
        navigate('/', { replace: true });
    }, [sessionToken, navigate]);

    // Sesión: en /plantillas se ignora el token guardado (modo invitado).
    useEffect(() => {
        if (isTemplateRoute) authStore.useGuestSession();
        else void authStore.usePersistedSession();
    }, [isTemplateRoute]);

    // Cargar el documento indicado por la ruta (una sola vez por carga).
    useEffect(() => {
        if (!loadKey || !slug || loadedKeyRef.current === loadKey) return;
        loadedKeyRef.current = loadKey;
        setIsLoadingShared(true);
        setLoadError(null);

        // Plantilla: copia EDITABLE EN MEMORIA sin sesión. El proyecto nunca se
        // recuerda como "actual" y el original nunca se modifica.
        if (isTemplateRoute) {
            fetchTemplateBySlug(slug)
                .then((template) => {
                    applyProjectToDocument(template);
                    projectStore.clear();
                    templateStore.set({ slug: template.slug, title: template.title });
                    setIsLoadingShared(false);
                })
                .catch((err: unknown) => {
                    setLoadError(err instanceof Error ? err.message : String(err));
                    setIsLoadingShared(false);
                });
            return;
        }

        loadProjectBySlug(slug)
            .then((project) => {
                // Los programs viajan dentro de circuitData: se restauran TODOS.
                applyProjectToDocument(project);
                // Un enlace compartido es una COPIA: se olvida el proyecto
                // recordado para que el guardado cree uno NUEVO.
                projectStore.clear();
                templateStore.clear();
                setIsLoadingShared(false);
            })
            .catch((err: unknown) => {
                setLoadError(err instanceof Error ? err.message : String(err));
                setIsLoadingShared(false);
            });
    }, [loadKey, slug, isTemplateRoute]);

    return { isLoadingShared, loadError, isTemplateRoute };
}
