import type { ComponentInstance, ComponentManifest, ParameterSpec } from '@types';
import { ManifestRegistry } from '@core/registry/manifestRegistry';
import { documentStore } from '../stores/documentStore';
import { simulationClient } from '../worker/simulationClient';
import { useDocument } from './hooks/useDocument';
import { useSelection } from './hooks/useSelection';
import { useComponentState } from './hooks/useComponentState';

/* ======================================================================== */
/*  Inspector flotante del canvas                                           */
/*                                                                          */
/*  Se monta SOBRE el lienzo (no en el Sidebar, que conserva sus pestañas): */
/*  al seleccionar un componente muestra sus parámetros configurables, sus  */
/*  interacciones (sliders ambientales, pulsador) y el estado en vivo que   */
/*  publica el Worker.                                                      */
/*                                                                          */
/*  - Parámetros  → `documentStore.updateComponentParam` (persisten en el   */
/*                  documento y reenvían LOAD_CIRCUIT).                     */
/*  - Interacciones → `simulationClient.interact` (viven en el Worker).     */
/* ======================================================================== */

const fmt = (v: unknown): string => {
    if (typeof v === 'number') return `${Number(v.toPrecision(4))}`;
    if (typeof v === 'boolean') return v ? 'sí' : 'no';
    if (v === undefined || v === null || v === '') return '—';
    return String(v);
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    color: '#546e7a',
    marginBottom: 3,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 12,
    padding: '3px 6px',
    border: '1px solid #b0bec5',
    borderRadius: 4,
    background: '#fff',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
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

function ParameterField({
    name,
    spec,
    value,
    onChange,
}: {
    name: string;
    spec: ParameterSpec;
    value: unknown;
    onChange: (value: number | string | boolean) => void;
}) {
    const label = spec.label ?? name;

    if (spec.type === 'enum') {
        return (
            <label style={{ display: 'block', marginBottom: 6 }}>
                <span style={labelStyle}>{label}</span>
                <select
                    style={inputStyle}
                    value={String(value ?? spec.default)}
                    onChange={(e) => {
                        const option = (spec.options ?? []).find((o) => String(o) === e.target.value);
                        onChange((option ?? e.target.value) as number | string | boolean);
                    }}
                >
                    {(spec.options ?? []).map((o) => (
                        <option key={String(o)} value={String(o)}>
                            {String(o)}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    if (spec.type === 'boolean') {
        return (
            <label
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                    fontSize: 12,
                    color: '#37474f',
                }}
            >
                <input
                    type="checkbox"
                    checked={Boolean(value ?? spec.default)}
                    onChange={(e) => onChange(e.target.checked)}
                />
                {label}
            </label>
        );
    }

    if (spec.type === 'string') {
        return (
            <label style={{ display: 'block', marginBottom: 6 }}>
                <span style={labelStyle}>{label}</span>
                <input
                    style={inputStyle}
                    type="text"
                    maxLength={spec.maxLength}
                    value={String(value ?? spec.default ?? '')}
                    onChange={(e) => onChange(e.target.value)}
                />
            </label>
        );
    }

    return (
        <label style={{ display: 'block', marginBottom: 6 }}>
            <span style={labelStyle}>
                {label}
                {spec.unit ? ` (${spec.unit})` : ''}
            </span>
            <input
                style={inputStyle}
                type="number"
                min={spec.min}
                max={spec.max}
                step={spec.step ?? 'any'}
                value={Number.isFinite(Number(value)) ? Number(value) : Number(spec.default ?? 0)}
                onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    // Se respeta el rango declarado en el manifiesto: el solver
                    // no debería recibir valores fuera de la especificación.
                    const min = spec.min ?? Number.NEGATIVE_INFINITY;
                    const max = spec.max ?? Number.POSITIVE_INFINITY;
                    onChange(Math.min(max, Math.max(min, next)));
                }}
            />
        </label>
    );
}

function InteractionField({
    name,
    label,
    gesture,
    min,
    max,
    step,
    unit,
    defaultValue,
    componentId,
    currentValue,
}: {
    name: string;
    label?: string;
    gesture: 'click' | 'drag' | 'slider' | 'press';
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    defaultValue?: number | boolean | string;
    componentId: string;
    currentValue: unknown;
}) {
    const title = label ?? name;
    const value = currentValue ?? defaultValue;

    if (gesture === 'slider' || gesture === 'drag') {
        const numeric = Number(value ?? min ?? 0);
        return (
            <label style={{ display: 'block', marginBottom: 8 }}>
                <span style={labelStyle}>
                    {title}: <strong>{fmt(value)}</strong>
                    {unit ?? ''}
                </span>
                <input
                    type="range"
                    style={{ width: '100%' }}
                    min={min}
                    max={max}
                    step={step ?? 'any'}
                    value={Number.isFinite(numeric) ? numeric : Number(min ?? 0)}
                    onChange={(e) => simulationClient.interact(componentId, name, Number(e.target.value))}
                />
            </label>
        );
    }

    if (gesture === 'press') {
        return (
            <button
                style={{ ...inputStyle, cursor: 'pointer', marginBottom: 6 }}
                onPointerDown={() => simulationClient.interact(componentId, name, true)}
                onPointerUp={() => simulationClient.interact(componentId, name, false)}
                onPointerLeave={() => simulationClient.interact(componentId, name, false)}
            >
                {title} (mantener pulsado)
            </button>
        );
    }

    // 'click': conmuta
    return (
        <button
            style={{ ...inputStyle, cursor: 'pointer', marginBottom: 6 }}
            onClick={() => simulationClient.interact(componentId, name, !value)}
        >
            {title}: {fmt(value)}
        </button>
    );
}

function InspectorBody({ instance, manifest }: { instance: ComponentInstance; manifest: ComponentManifest }) {
    const state = useComponentState(instance.id);
    const observables = manifest.observables ?? [];
    const hasState = observables.length > 0;

    return (
        <div
            style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 252,
                maxHeight: 'calc(100% - 20px)',
                overflowY: 'auto',
                background: 'rgba(255,255,255,0.97)',
                border: '1px solid #b0bec5',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                padding: '10px 12px',
                boxSizing: 'border-box',
                fontSize: 12,
                color: '#263238',
                fontFamily: 'inherit',
                zIndex: 10,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{manifest.displayName}</strong>
            </div>
            <div style={{ fontSize: 10, color: '#90a4ae', wordBreak: 'break-all' }}>
                {instance.id} · {manifest.id}
            </div>

            {Object.keys(manifest.parameters ?? {}).length > 0 && (
                <>
                    <SectionTitle>Parámetros</SectionTitle>
                    {Object.entries(manifest.parameters ?? {}).map(([key, spec]) => (
                        <ParameterField
                            key={key}
                            name={key}
                            spec={spec}
                            value={instance.params[key]}
                            onChange={(v) => documentStore.updateComponentParam(instance.id, key, v)}
                        />
                    ))}
                </>
            )}

            {(manifest.interactions ?? []).length > 0 && (
                <>
                    <SectionTitle>Interacciones</SectionTitle>
                    {manifest.interactions!.map((interaction) => (
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
            )}

            {hasState && (
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
            )}
        </div>
    );
}

/** Inspector flotante: `null` si no hay un componente seleccionado. */
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
