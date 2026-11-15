import {
    errorBoxStyle,
    errorMessageStyle,
    errorTitleStyle,
    retryButtonStyle,
} from './templatesStyles';

interface TemplatesErrorStateProps {
    message: string;
    onRetry: () => void;
}

/** Error de carga del catálogo con opción de reintentar. */
export function TemplatesErrorState({ message, onRetry }: TemplatesErrorStateProps) {
    return (
        <div role="alert" style={errorBoxStyle}>
            <div style={errorTitleStyle}>No se pudieron cargar las plantillas</div>
            <div style={errorMessageStyle}>{message}</div>
            <button onClick={onRetry} style={retryButtonStyle}>
                Reintentar
            </button>
        </div>
    );
}
