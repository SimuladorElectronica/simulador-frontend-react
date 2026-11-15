import { LoadOverlayCard } from './LoadOverlayCard';

interface LoadOverlayProps {
    isLoading: boolean;
    loadError: string | null;
    isTemplateRoute: boolean;
}

/** Overlay de carga / error para enlaces compartidos y plantillas. */
export function LoadOverlay({ isLoading, loadError, isTemplateRoute }: LoadOverlayProps) {
    if (!isLoading && !loadError) return null;

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(38, 50, 56, 0.75)',
                zIndex: 50,
            }}
        >
            <LoadOverlayCard
                isLoading={isLoading}
                loadError={loadError}
                isTemplateRoute={isTemplateRoute}
            />
        </div>
    );
}
