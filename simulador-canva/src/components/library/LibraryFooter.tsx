export interface LibraryFooterProps {
    message: string | null;
    copied: boolean;
    disabled: boolean;
    onCopy: () => void;
    onInsert: () => void;
}

/** Pie del modal: confirmación de la última acción y botones de copiar/insertar. */
export function LibraryFooter({ message, copied, disabled, onCopy, onInsert }: LibraryFooterProps) {
    return (
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
            <div aria-live="polite" style={{ flex: 1, fontSize: 11, color: '#2e7d32', minHeight: 16 }}>
                {message}
            </div>
            <button
                type="button"
                onClick={onCopy}
                disabled={disabled}
                style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    borderRadius: 6,
                    border: '1px solid #cfd8dc',
                    background: '#ffffff',
                    color: '#546e7a',
                    cursor: disabled ? 'default' : 'pointer',
                }}
            >
                {copied ? '✓ Copiado' : 'Copiar ejemplo'}
            </button>
            <button
                type="button"
                onClick={onInsert}
                disabled={disabled}
                style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: 'none',
                    background: disabled ? '#90a4ae' : '#1565c0',
                    color: '#ffffff',
                    cursor: disabled ? 'default' : 'pointer',
                }}
            >
                Insertar #include
            </button>
        </div>
    );
}
