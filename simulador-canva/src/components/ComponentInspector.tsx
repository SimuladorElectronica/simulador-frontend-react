import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { useDocument } from './hooks/useDocument';
import { useSelection } from './hooks/useSelection';
import { InspectorBody } from './inspector/InspectorBody';

/**
 * Inspector flotante del canvas.
 *
 * Se monta sobre el lienzo (no en el Sidebar): al seleccionar un componente
 * muestra sus parámetros configurables, sus interacciones (sliders
 * ambientales, pulsador) y el estado en vivo que publica el Worker.
 *
 * - Parámetros → `documentStore.updateComponentParam` (persisten en el
 *   documento y reenvían LOAD_CIRCUIT).
 * - Interacciones → `simulationClient.interact` (viven en el Worker).
 */
export function ComponentInspector() {
    const selection = useSelection();
    const doc = useDocument();

    if (selection?.kind !== 'component') return null;
    const instance = doc.components.find((c) => c.id === selection.id);
    if (!instance) return null;
    const manifest = ManifestRegistry.get(instance.type);
    if (!manifest) return null;

    return <InspectorBody instance={instance} manifest={manifest} />;
}
