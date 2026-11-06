import { useEffect, useRef } from 'react'
import { Palette } from './UIcomponents/Palette'
import { ProgramEditor } from './UIcomponents/ProgramEditor'
import { SimulatorCanvas } from './UIcomponents/SimulatorCanvas'
import { SimulationPanel } from './UIcomponents/SimulationPanel'
import { useDocument } from './UIcomponents/hooks/useDocument'
import { documentStore } from './stores/documentStore'
import { ManifestRegistry } from './core/registry/manifestRegistry'
import { simulationClient } from './worker/simulationClient'

function App() {
  const addAtCenterRef = useRef<(type: string) => void>(() => {})
  const doc = useDocument()

  // Enviar el circuito al worker solo cuando cambia la topología
  // (mover componentes en el canvas NO dispara LOAD_CIRCUIT: la proyección excluye posiciones).
  useEffect(() => {
    if (documentStore.hasTopologyChanged()) {
      simulationClient.loadCircuit(documentStore.getSimulationProjection(), ManifestRegistry.getAll())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ProgramEditor />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Palette onAdd={(type) => addAtCenterRef.current(type)} />
        </div>
      </div>
      <SimulatorCanvas
        registerAddAtCenter={(fn) => {
          addAtCenterRef.current = fn
        }}
      />
      <SimulationPanel />
    </div>
  )
}

export default App
