import type { ComponentInstance, ComponentManifest } from '@types';
import { documentStore } from '../../stores/documentStore';
import { fmt } from './format';
import { InteractionField } from './InteractionField';
import { ParameterField } from './ParameterField';

/** Título visual de una sección del inspector. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: '#78909c',
                margin: '12px 0 6px',
                borderBottom: '1px solid #eceff1',
                paddingBottom: 3,
            }}
        >
            {children}
        </div>
    );
}

/** Parámetros editables del manifiesto. */
export function ParametersSection({
    instance,
    manifest,
}: {
    instance: ComponentInstance;
    manifest: ComponentManifest;
}) {
    const parameters = manifest.parameters ?? {};
    if (Object.keys(parameters).length === 0) return null;

    return (
        <>
            <SectionTitle>Parámetros</SectionTitle>
            {Object.entries(parameters).map(([key, spec]) => (
                <ParameterField
                    key={key}
                    name={key}
                    spec={spec}
                    value={instance.params[key]}
                    onChange={(v) => documentStore.updateComponentParam(instance.id, key, v)}
                />
            ))}
        </>
    );
}

/** Interacciones declaradas por el manifiesto. */
export function InteractionsSection({
    instance,
    manifest,
    state,
}: {
    instance: ComponentInstance;
    manifest: ComponentManifest;
    state: Record<string, unknown>;
}) {
    const interactions = manifest.interactions ?? [];
    if (interactions.length === 0) return null;

    return (
        <>
            <SectionTitle>Interacciones</SectionTitle>
            {interactions.map((interaction) => (
                <InteractionField
                    key={interaction.name}
                    name={interaction.name}
                    label={interaction.label}
                    gesture={interaction.gesture}
                    min={interaction.min}
                    max={interaction.max}
                    step={interaction.step}
                    unit={interaction.unit}
                    defaultValue={interaction.defaultValue}
                    componentId={instance.id}
                    currentValue={state[interaction.name]}
                />
            ))}
        </>
    );
}

/** Observables publicados por el worker para este componente. */
export function LiveStateSection({
    instance,
    manifest,
    state,
}: {
    instance: ComponentInstance;
    manifest: ComponentManifest;
    state: Record<string, unknown>;
}) {
    const observables = manifest.observables ?? [];
    if (observables.length === 0) return null;

    return (
        <>
            <SectionTitle>Estado en vivo</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px', fontSize: 11 }}>
                {observables.map((name) => (
                    <div key={name} style={{ display: 'contents' }}>
                        <span style={{ color: '#78909c' }}>{name}</span>
                        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(state[name] ?? instance.params[name])}
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}
