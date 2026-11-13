import { useActiveTemplate } from '../stores/templateStore';

/**
 * Indicador discreto de modo plantilla: flota en la parte superior del
 * lienzo y no intercepta el puntero. Recuerda que se está editando una
 * copia en memoria y que el original no se modifica.
 */
export function TemplateBadge() {
    const template = useActiveTemplate();
    if (!template) return null;

    return (
        <div
            data-testid="template-badge"
            title="Plantilla: trabajás sobre una copia en memoria. Al guardar se crea un proyecto nuevo en tu cuenta (o un anónimo); el original no se modifica."
            style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 30,
                pointerEvents: 'none',
                maxWidth: '70%',
                padding: '4px 14px',
                borderRadius: 999,
                background: 'rgba(21, 101, 192, 0.9)',
                color: '#ffffff',
                fontSize: 11,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            }}
        >
            Plantilla: {template.title} · el original no se modifica
        </div>
    );
}
