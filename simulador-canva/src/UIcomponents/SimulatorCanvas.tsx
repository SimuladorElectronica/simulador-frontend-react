import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Group } from 'react-konva';
import Konva from 'konva';
import type { ComponentInstance, Wire, Vector2D } from '@domain-types';
import { createComponentInstance } from '@core/registry';
import { ComponentRenderer } from './ComponentRenderer';
import { ComponentDock } from './ComponentDock';

const CABLE_COLORS = [
  { name: 'Rojo', hex: '#e74c3c' },
  { name: 'Negro', hex: '#2c3e50' },
  { name: 'Azul', hex: '#3498db' },
  { name: 'Verde', hex: '#2ecc71' },
  { name: 'Amarillo', hex: '#f1c40f' },
  { name: 'Naranja', hex: '#e67e22' },
  { name: 'Blanco', hex: '#ecf0f1' },
];

const DOCK_WIDTH = 260; // Ancho del panel lateral

const INITIAL_COMPONENTS: ComponentInstance[] = [
  createComponentInstance('ESP32', 'esp32_1', { x: 80, y: 80 }),
  createComponentInstance('PROTOBOARD', 'proto_1', { x: 300, y: 80 }),
];

export const SimulatorCanvas: React.FC = () => {
  const [components, setComponents] = useState<ComponentInstance[]>(INITIAL_COMPONENTS);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string>('#e74c3c');
  const [drawingWire, setDrawingWire] = useState<{ fromPinId: string; currentPos: Vector2D } | null>(null);

  const [stageScale, setStageScale] = useState<number>(1);
  const [stagePos, setStagePos] = useState<Vector2D>({ x: 0, y: 0 });
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: window.innerWidth - DOCK_WIDTH,
    height: window.innerHeight,
  });

  const stageRef = useRef<Konva.Stage>(null);

  // Reescalado dinámico al cambiar la ventana
  useEffect(() => {
    const handleResize = () => {
      setCanvasDimensions({
        width: window.innerWidth - DOCK_WIDTH,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Eliminar componente y sus cables en cascada
  const handleDeleteComponent = (componentId: string) => {
    const compToDelete = components.find((c) => c.id === componentId);
    if (!compToDelete) return;

    const pinIdsToRemove = new Set(compToDelete.pins.map((p) => p.id));

    setWires((prevWires) =>
      prevWires.filter(
        (w) => !pinIdsToRemove.has(w.fromPinId) && !pinIdsToRemove.has(w.toPinId)
      )
    );

    if (drawingWire && pinIdsToRemove.has(drawingWire.fromPinId)) {
      setDrawingWire(null);
    }

    if (selectedComponentId === componentId) {
      setSelectedComponentId(null);
    }

    setComponents((prev) => prev.filter((c) => c.id !== componentId));
  };

  // Agregar componente centrado en el área visible del canvas
  const handleAddComponent = (type: string) => {
    const stage = stageRef.current;
    let spawnPos: Vector2D = { x: 150, y: 150 };

    if (stage) {
      spawnPos = {
        x: (-stagePos.x + canvasDimensions.width / 2) / stageScale - 50,
        y: (-stagePos.y + canvasDimensions.height / 2) / stageScale - 50,
      };
    }

    const newId = `${type.toLowerCase()}_${Date.now()}`;
    const newComponent = createComponentInstance(type, newId, spawnPos);

    setComponents((prev) => [...prev, newComponent]);
    setSelectedComponentId(newId);
    setSelectedWireId(null);
  };

  // Accesos rápidos por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setDrawingWire(null);
        setSelectedWireId(null);
        setSelectedComponentId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedComponentId) {
          handleDeleteComponent(selectedComponentId);
        } else if (selectedWireId) {
          setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
          setSelectedWireId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponentId, selectedWireId, drawingWire, components]);

  // Zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.2, Math.min(newScale, 4));

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const getPinAbsolutePos = (pinId: string): Vector2D => {
    for (const comp of components) {
      const pin = comp.pins.find((p) => p.id === pinId);
      if (pin) {
        return {
          x: comp.position.x + pin.relativePos.x,
          y: comp.position.y + pin.relativePos.y,
        };
      }
    }
    return { x: 0, y: 0 };
  };

  const handleDragMoveComponent = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x();
    const newY = e.target.y();

    setComponents((prev) =>
      prev.map((comp) => (comp.id === id ? { ...comp, position: { x: newX, y: newY } } : comp))
    );
  };

  const handlePinClick = (pinId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    setSelectedWireId(null);
    setSelectedComponentId(null);

    if (drawingWire) {
      if (drawingWire.fromPinId !== pinId) {
        setWires((prev) => [
          ...prev,
          {
            id: `wire_${Date.now()}`,
            fromPinId: drawingWire.fromPinId,
            toPinId: pinId,
            color: activeColor,
          },
        ]);
      }
      setDrawingWire(null);
    } else {
      const existingWireIndex = wires.findLastIndex(
        (w) => w.fromPinId === pinId || w.toPinId === pinId
      );

      if (existingWireIndex !== -1) {
        const existingWire = wires[existingWireIndex];
        const otherPinId =
          existingWire.fromPinId === pinId ? existingWire.toPinId : existingWire.fromPinId;

        setWires((prev) => prev.filter((_, idx) => idx !== existingWireIndex));
        setActiveColor(existingWire.color);
        setDrawingWire({
          fromPinId: otherPinId,
          currentPos: getPinAbsolutePos(pinId),
        });
      } else {
        setDrawingWire({
          fromPinId: pinId,
          currentPos: getPinAbsolutePos(pinId),
        });
      }
    }
  };

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setDrawingWire(null);
      setSelectedWireId(null);
      setSelectedComponentId(null);
    }
  };

  const handleMouseMove = () => {
    if (!drawingWire || !stageRef.current) return;
    const stage = stageRef.current;
    const relativePos = stage.getRelativePointerPosition();
    if (relativePos) {
      setDrawingWire({
        ...drawingWire,
        currentPos: relativePos,
      });
    }
  };

  const handleColorSelect = (colorHex: string) => {
    setActiveColor(colorHex);
    if (selectedWireId) {
      setWires((prev) =>
        prev.map((w) => (w.id === selectedWireId ? { ...w, color: colorHex } : w))
      );
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* ÁREA PRINCIPAL DEL CANVAS */}
      <div style={{ position: 'relative', flex: 1, height: '100%' }}>
        {/* BARRA DE HERRAMIENTAS FLOTANTE SUPERIOR: Solo Colores y Eliminación */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 10,
            background: '#1e1e1e',
            padding: '8px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            border: '1px solid #333',
            color: '#fff',
            fontFamily: 'sans-serif',
            fontSize: '13px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#aaa' }}>Color Cable:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {CABLE_COLORS.map((c) => (
              <button
                key={c.hex}
                title={c.name}
                onClick={() => handleColorSelect(c.hex)}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: c.hex,
                  border: activeColor === c.hex ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  transform: activeColor === c.hex ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                }}
              />
            ))}
          </div>

          {(selectedComponentId || selectedWireId) && (
            <>
              <div style={{ width: '1px', height: '18px', background: '#444' }} />
              <button
                onClick={() => {
                  if (selectedComponentId) handleDeleteComponent(selectedComponentId);
                  else if (selectedWireId) {
                    setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
                    setSelectedWireId(null);
                  }
                }}
                style={{
                  backgroundColor: '#c0392b',
                  color: '#fff',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                }}
              >
                Eliminar {selectedComponentId ? 'Componente' : 'Cable'} (Supr)
              </button>
            </>
          )}
        </div>

        {/* LIENZO KONVA */}
        <Stage
          width={canvasDimensions.width}
          height={canvasDimensions.height}
          onWheel={handleWheel}
          draggable={!drawingWire}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          onMouseMove={handleMouseMove}
          onClick={handleStageClick}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }
          }}
          ref={stageRef}
          style={{ background: '#121212', cursor: drawingWire ? 'crosshair' : 'default' }}
        >
          <Layer>
            {/* 1. COMPONENTES */}
            {components.map((comp) => {
              const isSelected = comp.id === selectedComponentId;
              return (
                <Group
                  key={comp.id}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    setSelectedComponentId(comp.id);
                    setSelectedWireId(null);
                  }}
                  onDragStart={() => {
                    setSelectedComponentId(comp.id);
                    setSelectedWireId(null);
                  }}
                >
                  {isSelected && (
                    <Rect
                      x={comp.position.x - 4}
                      y={comp.position.y - 4}
                      width={(comp.width || 120) + 8}
                      height={(comp.height || 90) + 8}
                      stroke="#3498db"
                      strokeWidth={2}
                      dash={[6, 4]}
                      cornerRadius={8}
                      listening={false}
                    />
                  )}
                  <ComponentRenderer
                    instance={comp}
                    onPinClick={handlePinClick}
                    onDragMove={(e) => handleDragMoveComponent(comp.id, e)}
                  />
                </Group>
              );
            })}

            {/* 2. CABLES CONECTADOS */}
            {wires.map((wire) => {
              const start = getPinAbsolutePos(wire.fromPinId);
              const end = getPinAbsolutePos(wire.toPinId);
              const isSelected = wire.id === selectedWireId;

              return (
                <React.Fragment key={wire.id}>
                  {isSelected && (
                    <Line
                      points={[start.x, start.y, end.x, end.y]}
                      stroke="#ffffff"
                      strokeWidth={8}
                      lineCap="round"
                      opacity={0.8}
                      listening={false}
                    />
                  )}
                  <Line
                    points={[start.x, start.y, end.x, end.y]}
                    stroke={wire.color}
                    strokeWidth={4}
                    lineCap="round"
                    hitStrokeWidth={5}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setSelectedWireId(wire.id);
                      setSelectedComponentId(null);
                      setActiveColor(wire.color);
                    }}
                  />
                </React.Fragment>
              );
            })}

            {/* 3. CABLE FLOTANTE */}
            {drawingWire && (() => {
              const start = getPinAbsolutePos(drawingWire.fromPinId);
              return (
                <Line
                  points={[start.x, start.y, drawingWire.currentPos.x, drawingWire.currentPos.y]}
                  stroke={activeColor}
                  strokeWidth={3}
                  dash={[6, 6]}
                  lineCap="round"
                  listening={false}
                />
              );
            })()}
          </Layer>
        </Stage>
      </div>

      {/* DOCK LATERAL DERECHO */}
      <ComponentDock onAddComponent={handleAddComponent} />
    </div>
  );
};