import type { LibraryCategory, LibraryDefinition } from '../../core/libraries/types';
import { chipStyle } from './libraryModalStyles';

export interface LibraryBrowserProps {
    query: string;
    onQueryChange: (query: string) => void;
    category: LibraryCategory | 'all';
    onCategoryChange: (category: LibraryCategory | 'all') => void;
    categories: LibraryCategory[];
    libraries: LibraryDefinition[];
    selectedId: string;
    onSelect: (id: string) => void;
}

/** Panel izquierdo del modal: buscador, filtros por categoría y listado. */
export function LibraryBrowser({
    query,
    onQueryChange,
    category,
    onCategoryChange,
    categories,
    libraries,
    selectedId,
    onSelect,
}: LibraryBrowserProps) {
    return (
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
                onChange={(event) => onQueryChange(event.target.value)}
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
                    onClick={() => onCategoryChange('all')}
                    aria-pressed={category === 'all'}
                    style={chipStyle(category === 'all')}
                >
                    Todas
                </button>
                {categories.map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => onCategoryChange(item)}
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
                {libraries.map((library) => {
                    const active = selectedId === library.id;
                    return (
                        <li key={library.id}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={active}
                                onClick={() => onSelect(library.id)}
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
                {libraries.length === 0 && (
                    <li style={{ padding: '8px 4px', color: '#78909c' }}>
                        Sin resultados para “{query}”.
                    </li>
                )}
            </ul>
        </div>
    );
}
