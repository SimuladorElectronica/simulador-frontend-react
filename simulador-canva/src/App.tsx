import { useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { SimulatorCanvas } from './components/SimulatorCanvas'
import { SimulationPanel } from './components/SimulationPanel'
import { TemplateBadge } from './components/TemplateBadge'
import { LoadOverlay } from './app/LoadOverlay'
import { useAppBootstrap } from './app/useAppBootstrap'

function App() {
  const addAtCenterRef = useRef<(type: string) => void>(() => {})
  const { isLoadingShared, loadError, isTemplateRoute } = useAppBootstrap()

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

      <LoadOverlay
        isLoading={isLoadingShared}
        loadError={loadError}
        isTemplateRoute={isTemplateRoute}
      />
    </div>
  )
}

export default App
