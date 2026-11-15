import type { TemplateSummary } from '../../services/templates';
import { TemplateCard } from './TemplateCard';
import { TemplatesErrorState } from './TemplatesErrorState';
import { mutedStyle } from './templatesStyles';

interface TemplatesListProps {
    templates: TemplateSummary[] | null;
    error: string | null;
    onRetry: () => void;
}

/** Estados posibles del catálogo: error, cargando, vacío o listado. */
export function TemplatesList({ templates, error, onRetry }: TemplatesListProps) {
    if (error) return <TemplatesErrorState message={error} onRetry={onRetry} />;
    if (!templates) return <div style={mutedStyle}>Cargando plantillas…</div>;
    if (templates.length === 0) {
        return <div style={mutedStyle}>Todavía no hay plantillas publicadas. Volvé más tarde.</div>;
    }

    return (
        <>
            {templates.map((template) => (
                <TemplateCard key={template.id || template.slug} template={template} />
            ))}
        </>
    );
}
