import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Sidebar } from './UIcomponents/Sidebar'
import { SimulatorCanvas } from './UIcomponents/SimulatorCanvas'
import { SimulationPanel } from './UIcomponents/SimulationPanel'
import { useDocument } from './UIcomponents/hooks/useDocument'
import { documentStore } from './stores/documentStore'
import { programEditorStore } from './stores/programEditorStore'
import { selectionStore } from './stores/selectionStore'
import { ManifestRegistry } from './core/registry/manifestRegistry'
import { simulationClient } from './worker/simulationClient'
import { loadProjectBySlug, normalizeCircuitDocument } from './services/api'
import { fetchTemplateBySlug } from './services/templates'
import { authStore } from './stores/authStore'
import { saveToken } from './services/session'
import { startFreshCircuit } from './services/freshCircuit'
import { projectStore } from './stores/projectStore'
import { templateStore } from './stores/templateStore'
import { TemplateBadge } from './UIcomponents/TemplateBadge'

// Restaura un proyecto del backend en el lienzo. Es el mismo camino de
// carga/validación para enlaces compartidos y para plantillas
// (normalizeCircuitDocument respeta el formatVersion del documento).
// El título canónico es el del proyecto en el backend: los circuitData
// guardados antes de sincronizar meta.name podían tener un meta.name viejo.
function applyProjectToDocument(project: { circuitData: unknown; title: string }) {
  const normalized = normalizeCircuitDocument(project.circuitData, project.title)
  const backendTitle = typeof project.title === 'string' ? project.title.trim() : ''
  if (backendTitle && backendTitle !== normalized.meta.name) {
    normalized.meta = { ...normalized.meta, name: backendTitle }
  }
  documentStore.replaceDocument(normalized)
  // El editor queda apuntando al MCU recién cargado en la próxima selección
  programEditorStore.reset()
  selectionStore.setSelection(null)
}

function App() {
  // /p/:slug o /share/:slug → cargar el circuito compartido del backend (como COPIA)
  // /plantillas/:slug        → abrir una PLANTILLA como copia editable en memoria (sin sesión)
  // /session/:token         → abrir con una sesión ya iniciada (el token se guarda y se retira de la URL)
  // /new o /…?new=1         → empezar en blanco: lienzo vacío y sin proyecto recordado
  const { slug, token: sessionToken } = useParams<{ slug?: string; token?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const addAtCenterRef = useRef<(type: string) => void>(() => {})
  const doc = useDocument()
  const isTemplateRoute = location.pathname.startsWith('/plantillas/')
  const loadKey = slug ? `${isTemplateRoute ? 'template' : 'share'}:${slug}` : null
  const [isLoadingShared, setIsLoadingShared] = useState(() => Boolean(slug))
  const [loadError, setLoadError] = useState<string | null>(null)
  const loadedKeyRef = useRef<string | null>(null)
  const sessionHandledRef = useRef(false)
  const freshHandledRef = useRef(false)

  const wantsFresh =
    location.pathname === '/new' || new URLSearchParams(location.search).get('new') === '1'

  // Enviar el circuito al worker solo cuando cambia la topología
  // (mover componentes en el canvas NO dispara LOAD_CIRCUIT: la proyección excluye posiciones).
  // Al reemplazar el documento por uno compartido, hasTopologyChanged() da true y se reenvía.
  useEffect(() => {
    if (documentStore.hasTopologyChanged()) {
      simulationClient.loadCircuit(documentStore.getSimulationProjection(), ManifestRegistry.getAll())
    }
  }, [doc])

  // /new o /…?new=1 → empezar un circuito desde cero (así enlaza el dashboard:
  // "Nuevo proyecto"). Vacía el lienzo y olvida el proyecto recordado para que
  // el primer guardado cree uno NUEVO en la cuenta (POST), no edite el último.
  useEffect(() => {
    if (!wantsFresh || freshHandledRef.current) return
    freshHandledRef.current = true
    const snap = documentStore.getSnapshot()
    const hasWork =
      snap.components.length + snap.wires.length + snap.programs.length > 0
    // En una pestaña nueva el lienzo ya está vacío y no se pregunta nada;
    // solo confirmamos si llegaríamos con trabajo sin guardar (SPA en caliente).
    if (!hasWork || window.confirm('¿Empezar un circuito vacío? Se limpia el lienzo actual.')) {
      startFreshCircuit()
    }
    navigate('/', { replace: true })
  }, [wantsFresh, navigate])

  // Sesión recibida por URL (/session/:token): guardar, validar con /auth/me y limpiar la URL
  useEffect(() => {
    if (!sessionToken || sessionHandledRef.current) return
    sessionHandledRef.current = true
    saveToken(sessionToken)
    void authStore.hydrate()
    navigate('/', { replace: true })
  }, [sessionToken, navigate])

  // Sesión: en /plantillas se ignora el token guardado (modo invitado por
  // defecto, seguro en equipos compartidos); en el resto se valida el token
  // persistido. Al salir de las plantillas se recupera la sesión guardada.
  useEffect(() => {
    if (isTemplateRoute) authStore.useGuestSession()
    else void authStore.usePersistedSession()
  }, [isTemplateRoute])

  // Cargar el documento indicado por la ruta (una sola vez por carga,
  // incluso con StrictMode; se repite si cambia el slug de la ruta)
  useEffect(() => {
    if (!loadKey || !slug || loadedKeyRef.current === loadKey) return
    loadedKeyRef.current = loadKey
    setIsLoadingShared(true)
    setLoadError(null)

    // Plantilla: copia EDITABLE EN MEMORIA sin sesión. El proyecto nunca se
    // recuerda como "actual" (al guardar se crea uno NUEVO a nombre del
    // usuario; PUT sobre la plantilla queda imposible) y el original nunca
    // se modifica.
    if (isTemplateRoute) {
      fetchTemplateBySlug(slug)
        .then((template) => {
          applyProjectToDocument(template)
          // Olvidar cualquier proyecto recordado: el próximo guardado es un POST nuevo
          projectStore.clear()
          templateStore.set({ slug: template.slug, title: template.title })
          setIsLoadingShared(false)
        })
        .catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : String(err))
          setIsLoadingShared(false)
        })
      return
    }

    loadProjectBySlug(slug)
      .then((project) => {
        // Los programs viajan dentro de circuitData: se restauran TODOS los
        // sketches, uno por cada ESP32 del circuito.
        applyProjectToDocument(project)
        // Un enlace compartido (entrega, starter de guía, etc.) es una COPIA:
        // se olvida cualquier proyecto recordado, así el guardado crea uno
        // NUEVO y nunca se modifica el original.
        projectStore.clear()
        templateStore.clear()
        setIsLoadingShared(false)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err))
        setIsLoadingShared(false)
      })
  }, [loadKey, slug, isTemplateRoute])

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Sidebar onAddComponent={(type) => addAtCenterRef.current(type)} />
      <SimulatorCanvas
        registerAddAtCenter={(fn) => {
          addAtCenterRef.current = fn
        }}
      />
      <SimulationPanel />
      <TemplateBadge />

      {/* Overlay de carga / error para enlaces compartidos */}
      {(isLoadingShared || loadError) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(38, 50, 56, 0.75)',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#263238',
              color: '#eceff1',
              borderRadius: 10,
              padding: '20px 28px',
              maxWidth: 420,
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            }}
          >
            {isLoadingShared && (
              <div>{isTemplateRoute ? 'Cargando plantilla…' : 'Cargando circuito compartido…'}</div>
            )}
            {loadError && (
              <>
                <div style={{ color: '#ff8a80', marginBottom: 12 }}>
                  {isTemplateRoute ? 'No se pudo cargar la plantilla' : 'No se pudo cargar el circuito'}
                  <br />
                  <span style={{ fontSize: 12 }}>{loadError}</span>
                </div>
                <a
                  href={isTemplateRoute ? '/plantillas' : '/'}
                  style={{
                    display: 'inline-block',
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: '#1565c0',
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: 13,
                  }}
                >
                  {isTemplateRoute ? 'Volver al catálogo de plantillas' : 'Ir al simulador'}
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
