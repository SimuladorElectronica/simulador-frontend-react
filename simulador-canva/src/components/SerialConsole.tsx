import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_UART_BAUD,
  UART_BAUD_RATES,
} from '../core/editor/arduinoCompletions';
import {
  filterSerialEntries,
  formatSerialBuffer,
  serialBufferBytes,
  shouldAutoScroll,
} from '../core/editor/serialFormat';
import type { SimLogEntry } from '../stores/simulationStore';

export interface SerialConsoleProps {
  entries: SimLogEntry[];
  /** Se llama al presionar "Limpiar" (el store vacía el buffer). */
  onClear?: () => void;
}

/**
 * Consola Serial UART (RX): monitor de `Serial.print/println`.
 * Controles propios de una consola UART: baud rate, autoscroll,
 * pausa, filtro, limpiar, copiar y exportar a .txt. El TX no está
 * conectado en esta iteración (el core solo emite RX).
 */
export function SerialConsole({ entries, onClear }: SerialConsoleProps) {
  const [baud, setBaud] = useState<number>(DEFAULT_UART_BAUD);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLPreElement>(null);

  const visible = useMemo(
    () => filterSerialEntries(entries, filter),
    [entries, filter],
  );
  const bufferText = useMemo(() => formatSerialBuffer(entries), [entries]);
  const bytes = useMemo(() => serialBufferBytes(entries), [entries]);

  useEffect(() => {
    if (shouldAutoScroll(autoScroll, paused) && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll, paused]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bufferText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([bufferText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial-${baud}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Consola Serial UART">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 6,
        }}
      >
        <strong style={{ fontSize: 11 }}>Consola Serial UART</strong>
        <span style={{ color: '#90a4ae' }}>RX</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          baud
          <select
            aria-label="Baud rate"
            value={baud}
            onChange={(e) => setBaud(Number(e.target.value))}
          >
            {UART_BAUD_RATES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />{' '}
          autoscroll
        </label>
        <label>
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
          />{' '}
          pausa
        </label>
        <button onClick={() => onClear?.()}>Limpiar</button>
        <button onClick={copy}>{copied ? '✓ Copiado' : 'Copiar'}</button>
        <button onClick={download}>Descargar .txt</button>
      </div>

      <input
        aria-label="Filtrar salida serie"
        placeholder="Filtrar salida…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
      />

      <pre
        ref={scrollRef}
        data-testid="serial-output"
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 140,
          overflowY: 'auto',
          color: '#a5d6a7',
          background: '#1b262c',
          padding: 6,
          borderRadius: 4,
        }}
      >
        {visible.map((l) => `[${l.timeUs}us] ${l.text}`).join('\n') || '(sin salida)'}
      </pre>

      <div style={{ color: '#90a4ae', fontSize: 10, marginTop: 4 }}>
        {entries.length} líneas · {bytes} bytes · {baud} baud
        {paused && ' · ⏸ en pausa'}
        {' · TX: no conectado en esta iteración'}
      </div>
    </section>
  );
}
