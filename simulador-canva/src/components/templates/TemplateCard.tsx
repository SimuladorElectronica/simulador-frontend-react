import { Link } from 'react-router-dom';
import type { TemplateSummary } from '../../services/templates';
import {
    cardActionStyle,
    cardDescriptionStyle,
    cardHeaderStyle,
    cardStyle,
    cardTitleStyle,
    cardUpdatedStyle,
} from './templatesStyles';

function formatUpdatedAt(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Tarjeta de una plantilla publicada, enlazada a su copia editable. */
export function TemplateCard({ template }: { template: TemplateSummary }) {
    const updated = formatUpdatedAt(template.updatedAt);

    return (
        <Link
            key={template.id || template.slug}
            to={`/plantillas/${encodeURIComponent(template.slug)}`}
            style={cardStyle}
        >
            <div style={cardHeaderStyle}>
                <strong style={cardTitleStyle}>{template.title}</strong>
                {updated && <span style={cardUpdatedStyle}>Actualizada {updated}</span>}
            </div>
            {template.description && (
                <p style={cardDescriptionStyle}>{template.description}</p>
            )}
            <span style={cardActionStyle}>Abrir en el simulador →</span>
        </Link>
    );
}
