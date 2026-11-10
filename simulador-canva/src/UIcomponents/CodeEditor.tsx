import Editor from '@monaco-editor/react';
import { registerArduinoSupport, type MonacoLike } from '../core/editor/arduinoMonaco';
import { ARDUINO_LANGUAGE_ID } from '../core/editor/arduinoCompletions';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Alto del editor: px o '100%' para ocupar el contenedor flexible */
  height?: number | string;
}

/**
 * Editor Monaco para sketches Arduino (C++ exclusivo).
 *
 * Este archivo es el único que importa `@monaco-editor/react` y se
 * carga con `React.lazy` desde `ProgramEditor`: el runtime de Monaco
 * (CDN, ~0 kB en el bundle inicial) NO se descarga hasta que el
 * usuario abre el editor. El wrapper en sí es de pocos kB, muy por
 * debajo del límite de 2.5 MB sin comprimir del chunk C++.
 */
export default function CodeEditor({ value, onChange, height = '100%' }: CodeEditorProps) {
  return (
    <Editor
      height={height}
      language={ARDUINO_LANGUAGE_ID}
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={(_editor, monaco) => {
        registerArduinoSupport(monaco as unknown as MonacoLike);
      }}
      // Solo C++: sin minimap el chunk y el DOM se mantienen livianos.
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        lineNumbers: 'on',
        automaticLayout: true,
        padding: { top: 8 },
        wordWrap: 'off',
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
      }}
      loading={<div style={{ padding: 12, color: '#eceff1' }}>Cargando editor…</div>}
    />
  );
}
