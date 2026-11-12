import { useState } from 'react';
import { useDocument } from './hooks/useDocument';
import { useEffect } from 'react';
import { ManifestRegistry } from '../core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { programEditorStore } from '../stores/programEditorStore';
import { selectionStore } from '../stores/selectionStore';
import { useAuth } from '../stores/authStore';
import { useCurrentProject, projectStore } from '../stores/projectStore';
import { ApiError, exportCircuit } from '../services/api';

/**
 * Bloque "Compartir proyecto" de la columna derecha.
 *
 * Guardado (con sesión iniciada): crea o EDITA un único proyecto del usuario
 * (el id se recuerda en projectStore, persistido entre recargas). Nunca
 * genera proyectos duplicados en guardados repetidos; si el backend rechaza
 * la edición (401 sin sesión / 403 proyecto ajeno / 404 borrado) la UI ofrece
 * "Guardar como proyecto nuevo" de forma explícita.
 */
export function ShareCircuit() {
    const doc = useDocument();
    const auth = useAuth();
    const currentProject = useCurrentProject();
    const [title, setTitle] = useState(() => doc.meta.name);
    const [isExporting, setIsExporting] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [savedUpdated, setSavedUpdated] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [canForceNew, setCanForceNew] = useState(false);
    const [copied, setCopied] = useState(false);

    const mcuCount = doc.components.filter((c) => ManifestRegistry.get(c.type)?.mcu).length;
    const programCount = doc.programs.length;
    const isLoggedIn = auth.status === 'authenticated';

    // Sincronizar el título cuando el documento cambie externamente (p. ej. al abrir un enlace compartido)
    useEffect(() => {
        setTitle(doc.meta.name);
    }, [doc.meta.name]);

    const handleExport = async (forceNew = false) => {
        setIsExporting(true);
        setError(null);
        setCopied(false);
        setCanForceNew(false);
        try {
            const project = await exportCircuit({ title, forceNew });
            setShareUrl(`${window.location.origin}/p/${project.shareSlug}`);
            setSavedUpdated(project.updated);
        } catch (err) {
            setShareUrl(null);
            setSavedUpdated(null);
            if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
                // No se puede editar el proyecto recordado: ofrecer copia nueva de forma explícita
                setError(`${err.message} — podés guardar una copia nueva.`);
                setCanForceNew(true);
            } else {
                setError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setIsExporting(false);
        }
    };

    const handleNewCircuit = () => {
        const confirmed = window.confirm(
            '¿Empezar un circuito vacío? Se limpia el lienzo y el próximo guardado creará un proyecto nuevo.',
        );
        if (!confirmed) return;
        documentStore.replaceDocument({
            formatVersion: 1,
            components: [],
            wires: [],
            programs: [],
            meta: { name: 'Proyecto Sin Título', createdAt: Date.now(), updatedAt: Date.now() },
        });
        programEditorStore.reset();
        selectionStore.setSelection(null);
        projectStore.clear();
        setShareUrl(null);
        setSavedUpdated(null);
        setError(null);
        setCanForceNew(false);
        setTitle('Proyecto Sin Título');
    };

    const handleCopy = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
        } catch {
            setError('No se pudo copiar el enlace; seleccionalo y copialo manualmente.');
        }
    };

    return (
        <section
            style={{
                borderBottom: '1px solid #37474f',
                paddingBottom: 12,
                marginBottom: 12,
            }}
        >
            <h2 style={{ margin: '0 0 8px', fontSize: 13 }}>Compartir proyecto</h2>

            <label htmlFor="share-title" style={{ display: 'block', fontSize: 10, color: '#90a4ae', marginBottom: 4 }}>
                Nombre del proyecto
            </label>
            <input
                id="share-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Circuito sin título"
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid #455a64',
                    background: '#1c262b',
                    color: '#eceff1',
                    fontSize: 12,
                    marginBottom: 8,
                }}
            />

            <div style={{ fontSize: 10, color: '#90a4ae', marginBottom: 8, lineHeight: 1.5 }}>
                {currentProject
                    ? isLoggedIn
                        ? `Se actualizará el proyecto guardado (slug ${currentProject.shareSlug}) en tu cuenta.`
                        : `Proyecto recordado (slug ${currentProject.shareSlug}). Iniciá sesión para poder editarlo; si no, se creará una copia nueva.`
                    : isLoggedIn
                        ? 'Se creará un proyecto nuevo en tu cuenta.'
                        : 'Sin sesión: se guardará como proyecto anónimo (solo lectura).'}
            </div>

            <button
                onClick={() => handleExport(false)}
                disabled={isExporting}
                style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: isExporting ? '#5c6bc0' : '#1565c0',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: isExporting ? 'wait' : 'pointer',
                }}
            >
                {isExporting ? 'Guardando…' : '⬆ Guardar / Exportar circuito'}
            </button>

            <button
                onClick={handleNewCircuit}
                style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #455a64',
                    background: 'transparent',
                    color: '#b0bec5',
                    fontSize: 11,
                    cursor: 'pointer',
                }}
            >
                Nuevo circuito vacío
            </button>

            {mcuCount > 1 && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#90a4ae' }}>
                    {programCount} programa(s) en {mcuCount} ESP32: el enlace restaura todos.
                </div>
            )}

            {error && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#ff8a80', wordBreak: 'break-word' }}>
                    {error}
                    {canForceNew && (
                        <button
                            onClick={() => handleExport(true)}
                            disabled={isExporting}
                            style={{
                                display: 'block',
                                marginTop: 6,
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#37474f',
                                color: '#eceff1',
                                fontSize: 11,
                                cursor: 'pointer',
                            }}
                        >
                            Guardar como proyecto nuevo
                        </button>
                    )}
                </div>
            )}

            {shareUrl && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: '#80cbc4', marginBottom: 4 }}>
                        {savedUpdated ? 'Proyecto actualizado ✓' : 'Proyecto creado ✓'} · Enlace público:
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input
                            readOnly
                            value={shareUrl}
                            onFocus={(e) => e.target.select()}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '6px 8px',
                                borderRadius: 4,
                                border: '1px solid #455a64',
                                background: '#1c262b',
                                color: '#80cbc4',
                                fontSize: 11,
                            }}
                        />
                        <button onClick={handleCopy} style={{ padding: '6px 10px', fontSize: 11 }}>
                            {copied ? '✓' : 'Copiar'}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
