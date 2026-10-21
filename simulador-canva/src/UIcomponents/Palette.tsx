import { useMemo } from 'react';
import type { ComponentManifest } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';

/** MIME usado para el drag & drop de la paleta hacia el canvas */
export const PALETTE_DND_MIME = 'application/x-sim-component';

const styles: Record<string, React.CSSProperties> = {
    sidebar: {
        width: 230,
        flexShrink: 0,
        background: '#fafafa',
        borderRight: '1px solid #cfd8dc',
        overflowY: 'auto',
        padding: 12,
        boxSizing: 'border-box',
        userSelect: 'none',
    },
    title: { margin: '0 0 4px', fontSize: 14, color: '#263238' },
    hint: { margin: '0 0 12px', fontSize: 11, color: '#78909c', lineHeight: 1.4 },
    category: {
        margin: '14px 0 6px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: '#546e7a',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 10px',
        marginBottom: 6,
        background: '#ffffff',
        border: '1px solid #cfd8dc',
        borderRadius: 6,
        cursor: 'grab',
        fontSize: 12,
        color: '#37474f',
    },
    pins: { fontSize: 10, color: '#90a4ae' },
};

interface PaletteProps {
    /** Doble clic en un componente: el canvas lo coloca en el centro de la vista */
    onAdd?: (type: string) => void;
}

/**
 * Paleta de componentes. Se genera íntegramente desde ManifestRegistry:
 * cualquier manifiesto registrado aparece automáticamente, agrupado por categoría.
 */
export function Palette({ onAdd }: PaletteProps) {
    const groups = useMemo(() => {
        const map = new Map<string, ComponentManifest[]>();
        for (const manifest of ManifestRegistry.getAll()) {
            const list = map.get(manifest.category) ?? [];
            list.push(manifest);
            map.set(manifest.category, list);
        }
        return Array.from(map.entries());
    }, []);

    return (
        <aside style={styles.sidebar}>
            <h2 style={styles.title}>Componentes</h2>
            <p style={styles.hint}>
                Arrastra al lienzo o haz doble clic. Para cablear, arrastra desde un pin hasta otro pin.
            </p>
            {groups.map(([category, manifests]) => (
                <div key={category}>
                    <div style={styles.category}>{category}</div>
                    {manifests.map((m) => (
                        <div
                            key={m.id}
                            style={styles.item}
                            draggable
                            title={`${m.displayName} (${m.id})`}
                            onDragStart={(e) => {
                                e.dataTransfer.setData(PALETTE_DND_MIME, m.id);
                                e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onDoubleClick={() => onAdd?.(m.id)}
                        >
                            <span>{m.displayName}</span>
                            <span style={styles.pins}>{m.pins.length} pines</span>
                        </div>
                    ))}
                </div>
            ))}
        </aside>
    );
}
