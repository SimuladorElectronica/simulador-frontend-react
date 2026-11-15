import { useShareCircuit } from './share/useShareCircuit';
import { ShareErrorBox, ShareMultiMcuNotice, ShareUrlBox } from './share/ShareResult';
import {
    infoStyle,
    labelStyle,
    primaryButtonStyle,
    secondaryButtonStyle,
    sectionStyle,
    titleInputStyle,
} from './share/shareCircuitStyles';

/**
 * Bloque "Compartir proyecto" de la columna derecha.
 *
 * Con sesión iniciada guarda o EDITA un único proyecto del usuario (el id se
 * recuerda en projectStore). Si el backend rechaza la edición (401/403/404)
 * la UI ofrece explícitamente "Guardar como proyecto nuevo". En modo
 * plantilla o enlace compartido el guardado siempre crea una copia NUEVA.
 */
export function ShareCircuit() {
    const share = useShareCircuit();

    return (
        <section style={sectionStyle}>
            <h2 style={{ margin: '0 0 8px', fontSize: 13 }}>Compartir proyecto</h2>

            <label htmlFor="share-title" style={labelStyle}>
                Nombre del proyecto
            </label>
            <input
                id="share-title"
                type="text"
                value={share.title}
                onChange={(e) => share.setTitle(e.target.value)}
                maxLength={200}
                placeholder="Circuito sin título"
                style={titleInputStyle}
            />

            <div style={infoStyle}>{share.infoMessage}</div>

            <button
                onClick={() => share.handleExport(false)}
                disabled={share.isExporting}
                style={primaryButtonStyle(share.isExporting)}
            >
                {share.isExporting ? 'Guardando…' : '⬆ Guardar / Exportar circuito'}
            </button>

            <button onClick={share.handleNewCircuit} style={secondaryButtonStyle}>
                Nuevo circuito vacío
            </button>

            {share.mcuCount > 1 && (
                <ShareMultiMcuNotice mcuCount={share.mcuCount} programCount={share.programCount} />
            )}

            {share.error && (
                <ShareErrorBox
                    error={share.error}
                    canForceNew={share.canForceNew}
                    isExporting={share.isExporting}
                    onForceNew={() => share.handleExport(true)}
                />
            )}

            {share.shareUrl && (
                <ShareUrlBox
                    shareUrl={share.shareUrl}
                    savedUpdated={share.savedUpdated}
                    copied={share.copied}
                    onCopy={share.handleCopy}
                />
            )}
        </section>
    );
}
