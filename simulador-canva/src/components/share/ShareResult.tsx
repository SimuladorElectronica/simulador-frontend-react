import { errorStyle, forceButtonStyle, shareUrlInputStyle } from './shareCircuitStyles';

interface ShareErrorBoxProps {
    error: string;
    canForceNew: boolean;
    isExporting: boolean;
    onForceNew: () => void;
}

/** Error de guardado, con opción de crear un proyecto nuevo si aplica. */
export function ShareErrorBox({ error, canForceNew, isExporting, onForceNew }: ShareErrorBoxProps) {
    return (
        <div style={errorStyle}>
            {error}
            {canForceNew && (
                <button onClick={onForceNew} disabled={isExporting} style={forceButtonStyle}>
                    Guardar como proyecto nuevo
                </button>
            )}
        </div>
    );
}

interface ShareUrlBoxProps {
    shareUrl: string;
    savedUpdated: boolean | null;
    copied: boolean;
    onCopy: () => void;
}

/** Enlace público recién creado/actualizado. */
export function ShareUrlBox({ shareUrl, savedUpdated, copied, onCopy }: ShareUrlBoxProps) {
    return (
        <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#80cbc4', marginBottom: 4 }}>
                {savedUpdated ? 'Proyecto actualizado ✓' : 'Proyecto creado ✓'} · Enlace público:
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    style={shareUrlInputStyle}
                />
                <button onClick={onCopy} style={{ padding: '6px 10px', fontSize: 11 }}>
                    {copied ? '✓' : 'Copiar'}
                </button>
            </div>
        </div>
    );
}

/** Aviso cuando el circuito tiene más de un MCU. */
export function ShareMultiMcuNotice({ mcuCount, programCount }: { mcuCount: number; programCount: number }) {
    return (
        <div style={{ marginTop: 6, fontSize: 10, color: '#90a4ae' }}>
            {programCount} programa(s) en {mcuCount} ESP32: el enlace restaura todos.
        </div>
    );
}
