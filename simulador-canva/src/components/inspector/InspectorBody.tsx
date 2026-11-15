import type { ComponentInstance, ComponentManifest } from '@types';
import { useComponentState } from '../hooks/useComponentState';
import { panelStyle } from './inspectorStyles';
import {
    InteractionsSection,
    LiveStateSection,
    ParametersSection,
} from './InspectorSections';

/** Contenido del inspector para un componente con manifiesto conocido. */
export function InspectorBody({
    instance,
    manifest,
}: {
    instance: ComponentInstance;
    manifest: ComponentManifest;
}) {
    const state = useComponentState(instance.id);

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{manifest.displayName}</strong>
            </div>
            <div style={{ fontSize: 10, color: '#90a4ae', wordBreak: 'break-all' }}>
                {instance.id} · {manifest.id}
            </div>

            <ParametersSection instance={instance} manifest={manifest} />
            <InteractionsSection instance={instance} manifest={manifest} state={state} />
            <LiveStateSection instance={instance} manifest={manifest} state={state} />
        </div>
    );
}
