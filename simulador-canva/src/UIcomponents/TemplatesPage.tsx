import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTemplates, type TemplateSummary } from '../services/templates';
import { authStore } from '../stores/authStore';
import { hasStoredToken } from '../services/session';

const pageStyle = {
    minHeight: '100vh',
    background: '#1c262b',
    color: '#eceff1',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '32px 16px',
    boxSizing: 'border-box',
} as const;

const columnStyle = {
    maxWidth: 760,
    margin: '0 auto',
} as const;

const cardStyle = {
    display: 'block',
    background: '#263238',
    border: '1px solid #37474f',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 12,
    textDecoration: 'none',
    color: 'inherit',
} as const;

function formatUpdatedAt(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Catálogo público de plantillas (/plantillas). No requiere sesión:
 * el enlace abre el simulador en modo invitado con una copia editable.
 */
export function TemplatesPage() {
    const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Reintento manual: cada clic incrementa el intento y el efecto recarga
    const [attempt, setAttempt] = useState(0);
    // El catálogo es público, pero en equipos compartidos ofrecemos cerrar la
    // sesión guardada (sessionStorage) desde acá también.
    const [hasSession, setHasSession] = useState(() => hasStoredToken());

    const closeSession = () => {
        authStore.logout();
        setHasSession(false);
    };

    const retry = () => {
        setTemplates(null);
        setError(null);
        setAttempt((n) => n + 1);
    };

    // Carga única al montar y en cada reintento (el listado es de solo lectura)
    useEffect(() => {
        let cancelled = false;
        listTemplates().then(
            (items) => {
                if (!cancelled) setTemplates(items);
            },
            (err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : String(err));
            },
        );
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    return (
        <main style={pageStyle}>
            <div style={columnStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Plantillas del simulador</h1>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        {hasSession && (
                            <button
                                onClick={closeSession}
                                title="Elimina la sesión guardada en este equipo"
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    border: '1px solid #455a64',
                                    background: 'transparent',
                                    color: '#b0bec5',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                }}
                            >
                                Cerrar sesión
                            </button>
                        )}
                        <Link to="/" style={{ color: '#80cbc4', fontSize: 13, textDecoration: 'none' }}>
                            Abrir simulador →
                        </Link>
                    </div>
                </div>
                <p style={{ color: '#90a4ae', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
                    Circuitos listos para usar. Se abren <strong>sin iniciar sesión</strong> como una
                    copia editable en memoria: los cambios nunca modifican el original y, al guardar,
                    se crea un proyecto nuevo en tu cuenta (o un anónimo sin sesión).
                </p>

                {templates === null && !error && <div style={{ color: '#90a4ae' }}>Cargando plantillas…</div>}

                {error && (
                    <div
                        role="alert"
                        style={{
                            background: '#37474f',
                            border: '1px solid #ff8a80',
                            borderRadius: 10,
                            padding: '16px 18px',
                        }}
                    >
                        <div style={{ color: '#ff8a80', fontWeight: 700, marginBottom: 6 }}>
                            No se pudieron cargar las plantillas
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 12 }}>{error}</div>
                        <button
                            onClick={retry}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#1565c0',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: 'pointer',
                            }}
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {templates !== null && templates.length === 0 && !error && (
                    <div style={{ color: '#90a4ae' }}>
                        Todavía no hay plantillas publicadas. Volvé más tarde.
                    </div>
                )}

                {templates?.map((template) => {
                    const updated = formatUpdatedAt(template.updatedAt);
                    return (
                        <Link
                            key={template.id || template.slug}
                            to={`/plantillas/${encodeURIComponent(template.slug)}`}
                            style={cardStyle}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                                <strong style={{ fontSize: 15, color: '#eceff1' }}>{template.title}</strong>
                                {updated && (
                                    <span style={{ fontSize: 11, color: '#90a4ae', whiteSpace: 'nowrap' }}>
                                        Actualizada {updated}
                                    </span>
                                )}
                            </div>
                            {template.description && (
                                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#b0bec5', lineHeight: 1.5 }}>
                                    {template.description}
                                </p>
                            )}
                            <span
                                style={{
                                    display: 'inline-block',
                                    marginTop: 10,
                                    fontSize: 12,
                                    color: '#80cbc4',
                                    fontWeight: 700,
                                }}
                            >
                                Abrir en el simulador →
                            </span>
                        </Link>
                    );
                })}
            </div>
        </main>
    );
}
