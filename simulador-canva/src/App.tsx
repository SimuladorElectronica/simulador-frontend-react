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
import { authStore } from './stores/authStore'
import { saveToken } from './services/session'
import { startFreshCircuit } from './services/freshCircuit'

function App() {
  // /p/:slug o /share/:slug → cargar el circuito compartido del backend
  // /session/:token         → abrir con una sesión ya iniciada (el token se guarda y se retira de la URL)
  // /new o /…?new=1         → empezar en blanco: lienzo vacío y sin proyecto recordado
  const { slug, token: sessionToken } = useParams<{ slug?: string; token?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const addAtCenterRef = useRef<(type: string) => void>(() => {})
  const doc = useDocument()
  const [isLoadingShared, setIsLoadingShared] = useState(() => Boolean(slug))
  const [loadError, setLoadError] = useState<string | null>(null)
  const loadStartedRef = useRef(false)
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

  // Al montar: validar el token persistido (si existe) contra el backend
  useEffect(() => {
    void authStore.hydrate()
  }, [])

  // Cargar el circuito indicado por el slug (una sola vez, incluso con StrictMode)
  useEffect(() => {
    if (!slug || loadStartedRef.current) return
    loadStartedRef.current = true
    setIsLoadingShared(true)
    setLoadError(null)

    loadProjectBySlug(slug)
      .then((project) => {
        // Los programs viajan dentro de circuitData: se restauran TODOS los
        // sketches, uno por cada ESP32 del circuito.
        const normalized = normalizeCircuitDocument(project.circuitData, project.title)
        // El título canónico es el del proyecto en el backend. Los circuitData
        // guardados antes de sincronizar meta.name podían tener un meta.name
        // viejo (p. ej. "Proyecto Sin Título") aunque projects.title fuera el
        // correcto; preferimos title para que el input muestre lo que el
        // usuario guarda y ve en el dashboard.
        const backendTitle = typeof project.title === 'string' ? project.title.trim() : ''
        if (backendTitle && backendTitle !== normalized.meta.name) {
          normalized.meta = { ...normalized.meta, name: backendTitle }
        }
        documentStore.replaceDocument(normalized)
        // El editor queda apuntando al MCU recién cargado en la próxima selección
        programEditorStore.reset()
        selectionStore.setSelection(null)
        setIsLoadingShared(false)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err))
        setIsLoadingShared(false)
      })
  }, [slug])

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
            {isLoadingShared && <div>Cargando circuito compartido…</div>}
            {loadError && (
              <>
                <div style={{ color: '#ff8a80', marginBottom: 12 }}>
                  No se pudo cargar el circuito
                  <br />
                  <span style={{ fontSize: 12 }}>{loadError}</span>
                </div>
                <a
                  href="/"
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
                  Ir al simulador
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
