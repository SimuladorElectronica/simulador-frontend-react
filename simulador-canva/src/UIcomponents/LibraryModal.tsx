import { useEffect, useState } from 'react';
import {
    getAllLibraries,
    getLibraryCategories,
    searchLibraries,
} from '../core/libraries/search';
import { injectLibraryIncludes } from '../core/libraries/injectInclude';
import { programEditorStore } from '../stores/programEditorStore';
import type { LibraryCategory, LibraryDefinition } from '../core/libraries/types';

export interface LibraryModalProps {
    onClose: () => void;
}

interface InsertFeedback {
    libraryId: string;
    kind: 'inserted' | 'already';
    inserted: string[];
    existing: string[];
}

/** Copia al portapapeles con respaldo si el navegador no expone `navigator.clipboard`. */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
        } catch {
            return false;
        }
    }
}

const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(38, 50, 56, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
} as const;

const dialogStyle = {
    background: '#ffffff',
    borderRadius: 8,
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.35)',
    width: 'min(780px, 96vw)',
    maxHeight: '82vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontSize: 12,
    color: '#263238',
} as const;

/**
 * Modal de librerías curadas del editor.
 *
 * - Búsqueda por tokens y filtro por categoría (catálogo local, nunca descarga nada).
 * - El botón principal "Insertar #include" solo añade los headers al sketch a
 *   través de `programEditorStore.setSource`: Monaco, al ser controlado, se
 *   actualiza solo. El ejemplo se muestra para copiar, nunca se inyecta.
 * - Se cierra con Escape o clic en el fondo.
 */
export function LibraryModal({ onClose }: LibraryModalProps) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<LibraryCategory | 'all'>('all');
    const [selectedId, setSelectedId] = useState<string>(() => getAllLibraries()[0]?.id ?? '');
    const [feedback, setFeedback] = useState<InsertFeedback | null>(null);
    const [copied, setCopied] = useState(false);

    // Escape cierra el modal.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    // El aviso "✓ Copiado" se borra solo tras unos segundos.
    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timer);
    }, [copied]);

    const categories = getLibraryCategories();
    const visible = searchLibraries(query, category === 'all' ? undefined : category);
    const selected = visible.find((library) => library.id === selectedId) ?? visible[0];

    const visibleFeedback = feedback && selected && feedback.libraryId === selected.id ? feedback : null;

    const insert = () => {
        if (!selected) return;
        const source = programEditorStore.getState().source;
        const result = injectLibraryIncludes(source, selected);
        if (result.inserted.length > 0) {
            programEditorStore.setSource(result.source);
        }
        setFeedback({
            libraryId: selected.id,
            kind: result.inserted.length > 0 ? 'inserted' : 'already',
            inserted: result.inserted,
            existing: result.existing,
        });
    };

    const copyExample = async () => {
        if (!selected) return;
        setCopied(await copyToClipboard(selected.example));
    };

    return (
        <div style={overlayStyle} onMouseDown={onClose} data-testid="library-modal-backdrop">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Librerías de código"
                style={dialogStyle}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderBottom: '1px solid #eceff1',
                        flexShrink: 0,
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: 13, color: '#263238' }}>📚 Librerías</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            fontSize: 16,
                            cursor: 'pointer',
                            color: '#546e7a',
                            padding: '2px 6px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    {/* Panel izquierdo: buscador, categorías y lista */}
                    <div
                        style={{
                            width: 250,
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRight: '1px solid #eceff1',
                            padding: 10,
                            gap: 8,
                            minHeight: 0,
                        }}
                    >
                        <input
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar (LCD, MQTT, WiFi…)"
                            aria-label="Buscar librería"
                            autoFocus
                            style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #cfd8dc',
                                fontSize: 12,
                                outline: 'none',
                            }}
                        />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setCategory('all')}
                                aria-pressed={category === 'all'}
                                style={chipStyle(category === 'all')}
                            >
                                Todas
                            </button>
                            {categories.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setCategory(item)}
                                    aria-pressed={category === item}
                                    style={chipStyle(category === item)}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                        <ul
                            role="listbox"
                            aria-label="Librerías disponibles"
                            style={{
                                listStyle: 'none',
                                margin: 0,
                                padding: 0,
                                overflowY: 'auto',
                                flex: 1,
                                minHeight: 0,
                            }}
                        >
                            {visible.map((library) => {
                                const active = selected?.id === library.id;
                                return (
                                    <li key={library.id}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            onClick={() => setSelectedId(library.id)}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '7px 9px',
                                                marginBottom: 4,
                                                border: active
                                                    ? '1px solid #1565c0'
                                                    : '1px solid transparent',
                                                borderRadius: 6,
                                                background: active ? '#e3f2fd' : '#f5f7f8',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <span style={{ fontWeight: 600, display: 'block' }}>
                                                {library.displayName}
                                            </span>
                                            <span style={{ fontSize: 10, color: '#78909c' }}>
                                                {library.category}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                            {visible.length === 0 && (
                                <li style={{ padding: '8px 4px', color: '#78909c' }}>
                                    Sin resultados para “{query}”.
                                </li>
                            )}
                        </ul>
                    </div>

                    {/* Panel derecho: detalle */}
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            overflowY: 'auto',
                            padding: 12,
                        }}
                    >
                        {selected ? (
                            <LibraryDetail library={selected} />
                        ) : (
                            <p style={{ color: '#78909c' }}>Elegí una librería de la lista.</p>
                        )}
                    </div>
                </div>

                {/* Pie: acciones */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderTop: '1px solid #eceff1',
                        flexShrink: 0,
                    }}
                >
                    <div
                        aria-live="polite"
                        style={{ flex: 1, fontSize: 11, color: '#2e7d32', minHeight: 16 }}
                    >
                        {visibleFeedback &&
                            (visibleFeedback.kind === 'inserted'
                                ? `✓ Insertado: ${visibleFeedback.inserted
                                      .map((header) => `<${header}>`)
                                      .join(', ')}`
                                : `✓ Ya estaba incluido (${visibleFeedback.existing
                                      .map((header) => `<${header}>`)
                                      .join(', ')})`)}
                    </div>
                    <button
                        type="button"
                        onClick={copyExample}
                        disabled={!selected}
                        style={{
                            padding: '6px 10px',
                            fontSize: 11,
                            borderRadius: 6,
                            border: '1px solid #cfd8dc',
                            background: '#ffffff',
                            color: '#546e7a',
                            cursor: selected ? 'pointer' : 'default',
                        }}
                    >
                        {copied ? '✓ Copiado' : 'Copiar ejemplo'}
                    </button>
                    <button
                        type="button"
                        onClick={insert}
                        disabled={!selected}
                        style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: 'none',
                            background: selected ? '#1565c0' : '#90a4ae',
                            color: '#ffffff',
                            cursor: selected ? 'pointer' : 'default',
                        }}
                    >
                        Insertar #include
                    </button>
                </div>
            </div>
        </div>
    );
}

function chipStyle(active: boolean) {
    return {
        padding: '3px 10px',
        fontSize: 11,
        borderRadius: 12,
        border: active ? '1px solid #1565c0' : '1px solid #cfd8dc',
        background: active ? '#1565c0' : '#ffffff',
        color: active ? '#ffffff' : '#546e7a',
        cursor: 'pointer',
    } as const;
}

function LibraryDetail({ library }: { library: LibraryDefinition }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
                <h3 style={{ margin: '0 0 2px', fontSize: 13 }}>{library.displayName}</h3>
                <div style={{ fontSize: 10, color: '#78909c' }}>{library.category}</div>
            </div>
            <p style={{ margin: 0, lineHeight: 1.45 }}>{library.description}</p>

            <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                    Headers
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {library.headers.map((header) => (
                        <code
                            key={header}
                            style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#eceff1',
                                fontSize: 11,
                            }}
                        >
                            {`#include <${header}>`}
                        </code>
                    ))}
                </div>
            </div>

            {library.constructorSignature && (
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                        Declaración
                    </div>
                    <code
                        style={{
                            display: 'block',
                            padding: '6px 8px',
                            borderRadius: 4,
                            background: '#263238',
                            color: '#eceff1',
                            fontSize: 11,
                            wordBreak: 'break-word',
                        }}
                    >
                        {library.constructorSignature}
                    </code>
                </div>
            )}

            <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                    Métodos
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {library.methods.map((method) => (
                        <li
                            key={method.name}
                            style={{ borderBottom: '1px solid #f0f4f5', padding: '4px 0' }}
                        >
                            <code style={{ fontSize: 11 }}>{method.signature}</code>
                            <div style={{ fontSize: 10, color: '#78909c', lineHeight: 1.4 }}>
                                {method.documentation}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#546e7a' }}>
                    Ejemplo
                </div>
                <pre
                    style={{
                        margin: 0,
                        padding: 8,
                        borderRadius: 6,
                        background: '#263238',
                        color: '#eceff1',
                        fontSize: 10.5,
                        lineHeight: 1.45,
                        overflowX: 'auto',
                        whiteSpace: 'pre',
                    }}
                >
                    {library.example}
                </pre>
            </div>
        </div>
    );
}
