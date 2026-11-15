import { useState } from 'react';
import { useDocument } from '../hooks/useDocument';
import { ManifestRegistry } from '../../core/registry/manifestRegistry';
import { useAuth } from '../../stores/authStore';
import { useCurrentProject } from '../../stores/projectStore';
import { useActiveTemplate } from '../../stores/templateStore';
import { ApiError, exportCircuit } from '../../services/api';
import { startFreshCircuit, FRESH_CIRCUIT_NAME } from '../../services/freshCircuit';
import { buildInfoMessage } from './shareMessages';

/** Estado y acciones del bloque "Compartir proyecto". */
export function useShareCircuit() {
    const doc = useDocument();
    const auth = useAuth();
    const currentProject = useCurrentProject();
    const activeTemplate = useActiveTemplate();
    const [title, setTitle] = useState(() => doc.meta.name);
    // Ajustar el estado durante el render (patrón oficial de React): si el
    // documento cambió externamente (p. ej. al abrir un enlace compartido o en
    // "Nuevo circuito vacío"), sincronizamos el input. Comparar con el valor
    // anterior evita bucles: el render siguiente ya ve los valores iguales.
    const [prevDocName, setPrevDocName] = useState(() => doc.meta.name);
    if (prevDocName !== doc.meta.name) {
        setPrevDocName(doc.meta.name);
        setTitle(doc.meta.name);
    }
    const [isExporting, setIsExporting] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [savedUpdated, setSavedUpdated] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [canForceNew, setCanForceNew] = useState(false);
    const [copied, setCopied] = useState(false);

    const mcuCount = doc.components.filter((c) => ManifestRegistry.get(c.type)?.mcu).length;
    const programCount = doc.programs.length;
    const isLoggedIn = auth.status === 'authenticated';

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
        startFreshCircuit();
        setShareUrl(null);
        setSavedUpdated(null);
        setError(null);
        setCanForceNew(false);
        setTitle(FRESH_CIRCUIT_NAME);
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

    const infoMessage = buildInfoMessage(currentProject, activeTemplate, isLoggedIn);

    return {
        title,
        setTitle,
        isExporting,
        shareUrl,
        savedUpdated,
        error,
        canForceNew,
        copied,
        mcuCount,
        programCount,
        infoMessage,
        handleExport,
        handleNewCircuit,
        handleCopy,
    };
}
