import { useEffect, useState } from 'react';
import { listTemplates, type TemplateSummary } from '../../services/templates';

interface TemplatesCatalog {
    templates: TemplateSummary[] | null;
    error: string | null;
    retry: () => void;
}

/** Carga el catálogo público y permite reintentar tras un error. */
export function useTemplatesCatalog(): TemplatesCatalog {
    const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Reintento manual: cada clic incrementa el intento y el efecto recarga
    const [attempt, setAttempt] = useState(0);

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

    return { templates, error, retry };
}
