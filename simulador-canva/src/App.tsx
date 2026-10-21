import { useRef } from 'react'
import { Palette } from './UIcomponents/Palette'
import { SimulatorCanvas } from './UIcomponents/SimulatorCanvas'

function App() {
  // El canvas registra aquí su método "añadir en el centro de la vista"
  const addAtCenterRef = useRef<(type: string) => void>(() => {})

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
      <Palette onAdd={(type) => addAtCenterRef.current(type)} />
      <SimulatorCanvas
        registerAddAtCenter={(fn) => {
          addAtCenterRef.current = fn
        }}
      />
    </div>
  )
}

export default App
