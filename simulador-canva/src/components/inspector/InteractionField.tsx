import { simulationClient } from '../../worker/simulationClient';
import { fmt } from './format';
import { inputStyle, labelStyle } from './inspectorStyles';

export interface InteractionFieldProps {
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
}

interface GestureProps {
    title: string;
    name: string;
    componentId: string;
    value: unknown;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
}

function sliderValue(value: unknown, min: number | undefined): number {
    const numeric = Number(value ?? min ?? 0);
    return Number.isFinite(numeric) ? numeric : Number(min ?? 0);
}

/** Slider continuo (o arrastre) de una interacción. */
function SliderInteraction({ title, name, componentId, value, min, max, step, unit }: GestureProps) {
    const safeValue = sliderValue(value, min);

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
                value={safeValue}
                onChange={(e) => simulationClient.interact(componentId, name, Number(e.target.value))}
            />
        </label>
    );
}

/** Botón de pulsación momentánea. */
function PressInteraction({ title, name, componentId }: GestureProps) {
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

/** Botón que conmuta el valor al hacer clic. */
function ClickInteraction({ title, name, componentId, value }: GestureProps) {
    return (
        <button
            style={{ ...inputStyle, cursor: 'pointer', marginBottom: 6 }}
            onClick={() => simulationClient.interact(componentId, name, !value)}
        >
            {title}: {fmt(value)}
        </button>
    );
}

const GESTURE_COMPONENTS = {
    slider: SliderInteraction,
    drag: SliderInteraction,
    press: PressInteraction,
    click: ClickInteraction,
} as const;

/** Control de una interacción (slider, pulsador o conmutador) del componente. */
export function InteractionField({
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
}: InteractionFieldProps) {
    const props: GestureProps = {
        title: label ?? name,
        name,
        componentId,
        value: currentValue ?? defaultValue,
        min,
        max,
        step,
        unit,
    };
    const GestureControl = GESTURE_COMPONENTS[gesture];

    return <GestureControl {...props} />;
}
