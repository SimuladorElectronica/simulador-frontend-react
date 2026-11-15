import { TemplatesHeader } from './templates/TemplatesHeader';
import { TemplatesList } from './templates/TemplatesList';
import { useTemplatesCatalog } from './templates/useTemplatesCatalog';
import { columnStyle, introStyle, pageStyle } from './templates/templatesStyles';

/**
 * Catálogo público de plantillas (/plantillas). No requiere sesión:
 * el enlace abre el simulador en modo invitado con una copia editable.
 */
export function TemplatesPage() {
    const { templates, error, retry } = useTemplatesCatalog();

    return (
        <main style={pageStyle}>
            <div style={columnStyle}>
                <TemplatesHeader />
                <p style={introStyle}>
                    Circuitos listos para usar. Se abren <strong>sin iniciar sesión</strong> como una
                    copia editable en memoria: los cambios nunca modifican el original y, al guardar,
                    se crea un proyecto nuevo en tu cuenta (o un anónimo sin sesión).
                </p>
                <TemplatesList templates={templates} error={error} onRetry={retry} />
            </div>
        </main>
    );
}
