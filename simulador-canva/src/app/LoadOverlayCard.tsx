interface LoadOverlayCardProps {
    isLoading: boolean;
    loadError: string | null;
    isTemplateRoute: boolean;
}

const loadingLabel = (isTemplate: boolean) =>
    isTemplate ? 'Cargando plantilla…' : 'Cargando circuito compartido…';

const errorLabel = (isTemplate: boolean) =>
    isTemplate ? 'No se pudo cargar la plantilla' : 'No se pudo cargar el circuito';

const backHref = (isTemplate: boolean) => (isTemplate ? '/plantillas' : '/');

const backLabel = (isTemplate: boolean) =>
    isTemplate ? 'Volver al catálogo de plantillas' : 'Ir al simulador';

/** Tarjeta interior del overlay de carga/error. */
export function LoadOverlayCard({ isLoading, loadError, isTemplateRoute }: LoadOverlayCardProps) {
    return (
        <div
            style={{
                background: '#263238',
                color: '#eceff1',
                borderRadius: 10,
                padding: '20px 28px',
                maxWidth: 420,
                textAlign: 'center',
                boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            }}
        >
            {isLoading && <div>{loadingLabel(isTemplateRoute)}</div>}
            {loadError && (
                <>
                    <div style={{ color: '#ff8a80', marginBottom: 12 }}>
                        {errorLabel(isTemplateRoute)}
                        <br />
                        <span style={{ fontSize: 12 }}>{loadError}</span>
                    </div>
                    <a
                        href={backHref(isTemplateRoute)}
                        style={{
                            display: 'inline-block',
                            padding: '8px 14px',
                            borderRadius: 6,
                            background: '#1565c0',
                            color: '#ffffff',
                            textDecoration: 'none',
                            fontSize: 13,
                        }}
                    >
                        {backLabel(isTemplateRoute)}
                    </a>
                </>
            )}
        </div>
    );
}
