import type { ParameterSpec } from '@types';
import { inputStyle, labelStyle } from './inspectorStyles';

export interface ParameterFieldProps {
    name: string;
    spec: ParameterSpec;
    value: unknown;
    onChange: (value: number | string | boolean) => void;
}

interface TypedFieldProps {
    label: string;
    spec: ParameterSpec;
    value: unknown;
    onChange: (value: number | string | boolean) => void;
}

/** Select de un parámetro de tipo `enum`. */
export function EnumParameterField({ label, spec, value, onChange }: TypedFieldProps) {
    const options = spec.options ?? [];
    return (
        <label style={{ display: 'block', marginBottom: 6 }}>
            <span style={labelStyle}>{label}</span>
            <select
                style={inputStyle}
                value={String(value ?? spec.default)}
                onChange={(e) => {
                    const option = options.find((o) => String(o) === e.target.value);
                    onChange((option ?? e.target.value) as number | string | boolean);
                }}
            >
                {options.map((o) => (
                    <option key={String(o)} value={String(o)}>
                        {String(o)}
                    </option>
                ))}
            </select>
        </label>
    );
}

/** Checkbox de un parámetro booleano. */
export function BooleanParameterField({ label, spec, value, onChange }: TypedFieldProps) {
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

/** Input de texto de un parámetro string. */
export function StringParameterField({ label, spec, value, onChange }: TypedFieldProps) {
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

function clampToSpec(next: number, spec: ParameterSpec): number {
    const min = spec.min ?? Number.NEGATIVE_INFINITY;
    const max = spec.max ?? Number.POSITIVE_INFINITY;
    return Math.min(max, Math.max(min, next));
}

function initialNumber(value: unknown, spec: ParameterSpec): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number(spec.default ?? 0);
}

/** Input numérico con el rango declarado en el manifiesto. */
export function NumberParameterField({ label, spec, value, onChange }: TypedFieldProps) {
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
                value={initialNumber(value, spec)}
                onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    onChange(clampToSpec(next, spec));
                }}
            />
        </label>
    );
}

/** Campo de un parámetro declarado en el manifiesto del componente. */
export function ParameterField({ name, spec, value, onChange }: ParameterFieldProps) {
    const label = spec.label ?? name;
    const props: TypedFieldProps = { label, spec, value, onChange };

    if (spec.type === 'enum') return <EnumParameterField {...props} />;
    if (spec.type === 'boolean') return <BooleanParameterField {...props} />;
    if (spec.type === 'string') return <StringParameterField {...props} />;
    return <NumberParameterField {...props} />;
}
