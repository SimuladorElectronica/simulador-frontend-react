import React from 'react';
import { COMPONENT_REGISTRY } from '@core/registry';

interface ComponentDockProps {
  onAddComponent: (type: string) => void;
}

export const ComponentDock: React.FC<ComponentDockProps> = ({ onAddComponent }) => {
  return (
    <aside
      style={{
        width: '260px',
        height: '100%',
        backgroundColor: '#1e1e1e',
        borderLeft: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        boxShadow: '-4px 0 12px rgba(0,0,0,0.4)',
        fontFamily: 'sans-serif',
        color: '#fff',
        userSelect: 'none',
      }}
    >
      {/* Encabezado del Dock */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #333',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          color: '#ecf0f1',
        }}
      >
        Catálogo de Componentes
      </div>

      {/* Lista con Scroll Vertical */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {Object.entries(COMPONENT_REGISTRY).map(([type, descriptor]) => (
          <button
            key={type}
            onClick={() => onAddComponent(type)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '12px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #3d3d3d',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#333';
              e.currentTarget.style.borderColor = '#3498db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2a2a2a';
              e.currentTarget.style.borderColor = '#3d3d3d';
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#3498db' }}>
              + {descriptor.label || type}
            </span>
            <span style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              Dimensiones: {descriptor.defaultSize.width}x{descriptor.defaultSize.height}px
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
};