import { useEffect, useState } from 'react';
import {
    getAllLibraries,
    getLibraryCategories,
    searchLibraries,
} from '../core/libraries/search';
import { injectLibraryIncludes } from '../core/libraries/injectInclude';
import { programEditorStore } from '../stores/programEditorStore';
import type { LibraryCategory } from '../core/libraries/types';
import { LibraryBrowser } from './library/LibraryBrowser';
import { LibraryDetail } from './library/LibraryDetail';
import { LibraryFooter } from './library/LibraryFooter';
import { copyToClipboard } from './library/clipboard';
import { feedbackMessage } from './library/feedbackMessage';
import type { InsertFeedback } from './library/feedbackMessage';
import { closeButtonStyle, dialogStyle, overlayStyle } from './library/libraryModalStyles';

export interface LibraryModalProps {
    onClose: () => void;
}

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
                    <button type="button" onClick={onClose} aria-label="Cerrar" style={closeButtonStyle}>
                        ✕
                    </button>
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    <LibraryBrowser
                        query={query}
                        onQueryChange={setQuery}
                        category={category}
                        onCategoryChange={setCategory}
                        categories={categories}
                        libraries={visible}
                        selectedId={selected?.id ?? ''}
                        onSelect={setSelectedId}
                    />
                    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 12 }}>
                        {selected ? (
                            <LibraryDetail library={selected} />
                        ) : (
                            <p style={{ color: '#78909c' }}>Elegí una librería de la lista.</p>
                        )}
                    </div>
                </div>

                <LibraryFooter
                    message={visibleFeedback ? feedbackMessage(visibleFeedback) : null}
                    copied={copied}
                    disabled={!selected}
                    onCopy={copyExample}
                    onInsert={insert}
                />
            </div>
        </div>
    );
}
