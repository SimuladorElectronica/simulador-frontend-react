export type ElectricalPrimitiveType =
    | 'groundRef'
    | 'voltageSource'
    | 'gpio'
    | 'resistor'
    | 'led'
    | 'switch'
    | 'potentiometer'
    | 'ldr';

export interface ComponentPinManifest {
    id: string;
    label: string;
    position: { x: number; y: number };
    kind: 'power' | 'ground' | 'gpio' | 'analog' | 'io' | 'passive';
    gpio?: {
        number: number;
        capabilities: ('digitalIn' | 'digitalOut' | 'adc' | 'dac' | 'pwm' | 'touch')[];
        inputOnly?: boolean;
    };
}

export interface MonitorSpec {
    element: string;
    quantity: 'power' | 'voltage' | 'current';
    comparison: 'above' | 'below';
    limit: number;
    duration: number; // en us virtuales
    event: string;
    action: 'destroy' | 'reset' | 'notify';
    scope?: 'element' | 'component';
}

/**
 * Parámetro configurable de una instancia (se edita en el inspector del
 * canvas). Un solo manifiesto describe todos los valores posibles: la
 * resistencia, por ejemplo, es `core/resistor@1` con `resistance` numérico,
 * no un manifiesto distinto por cada valor.
 */
export interface ParameterSpec {
    type: 'number' | 'enum' | 'boolean' | 'string';
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    /** Longitud máxima para `type === 'string'` (p. ej. 16 en la LCD 16x2) */
    maxLength?: number;
    /** Valores permitidos cuando `type === 'enum'` (select) */
    options?: Array<string | number>;
    default: unknown;
}

/** Cómo se convierte un observable en un atributo/contenido del SVG */
interface VisualMappingBase {
    /** Id del elemento SVG objetivo (si no se declara en la regla) */
    targetId?: string;
}

export type VisualMapping = VisualMappingBase &
    (
        /** El valor del observable se usa tal cual (colores, textos, …) */
        | { type: 'value' }
        /** Búsqueda por String(valor): `{ "true": "#2ecc71", "false": "#7f8c8d" }` */
        | { type: 'discrete'; values: Record<string, string | number> }
        /** Interpolación lineal sourceMin..sourceMax → min..max */
        | {
              type: 'linear';
              min: number;
              max: number;
              sourceMin?: number;
              sourceMax?: number;
              decimals?: number;
          }
        /** Texto formateado: `{ type: 'text', decimals: 1, suffix: 'V' }` */
        | {
              type: 'text';
              decimals?: number;
              prefix?: string;
              suffix?: string;
              /** 'ohms' formatea 4700 → "4.7kΩ" */
              format?: 'ohms';
          }
        /** Ángulo: value (sourceMin..sourceMax) → from..to grados */
        | {
              type: 'rotate';
              centerX: number;
              centerY: number;
              from?: number;
              to?: number;
              sourceMin?: number;
              sourceMax?: number;
          }
        /** Bandas de color de una resistencia a partir de su valor en ohmios */
        | {
              type: 'bands';
              startX: number;
              startY: number;
              width: number;
              height: number;
              /** Separación entre bandas consecutivas */
              pitch: number;
          }
    );

/**
 * Regla de actualización visual: el valor de `observable` (estado publicado
 * por el Worker + parámetros de la instancia) se convierte en el atributo
 * `property` del elemento SVG con id `targetId`.
 *
 * `property` también admite dos casos especiales:
 *  - 'text'   → contenido de un `<text id="…">`
 *  - 'content' → contenido interno de cualquier elemento (p. ej. un `<g>`)
 */
export interface VisualRule {
    observable: string;
    property: string;
    mapping: VisualMapping;
    targetId?: string;
}

/** Interacción declarada por el manifiesto (genera controles en el inspector) */
export interface InteractionSpec {
    /** Campo enviado al Worker con INTERACT (y nombre del observable) */
    name: string;
    gesture: 'click' | 'drag' | 'slider' | 'press';
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    defaultValue?: number | boolean | string;
}

/**
 * Comportamiento electromecánico declarativo (p. ej. el relé: la bobina
 * cierra/abre los contactos). Lo aplica el Worker tras cada resolución.
 */
export interface VoltageSwitchBehavior {
    type: 'voltageSwitch';
    /** Elemento que mide la tensión de la bobina */
    coilElement: string;
    /** Elemento `switch` cuyo `closed` se controla */
    switchElement: string;
    /** Tensión (V) a partir de la que el contacto conmuta */
    threshold: number;
    /** true → el contacto cierra cuando la bobina NO está energizada (NC) */
    inverted?: boolean;
}

export type ComponentBehavior = VoltageSwitchBehavior;

export interface ComponentManifest {
    id: string; // ej: "core/led@1"
    schemaVersion: number;
    version: string;
    displayName: string;
    category: string;
    mcu?: { platform: string };
    size: { width: number; height: number };
    art: string; // SVG sanitizado
    pins: ComponentPinManifest[];
    internalGroups?: string[][];
    elements: Array<{
        id: string;
        primitive: ElectricalPrimitiveType;
        ports: Record<string, string>; // rol -> pinId
        params: Record<string, number>;
    }>;
    monitors?: MonitorSpec[];
    parameters?: Record<string, ParameterSpec>;
    observables?: string[];
    visualRules?: VisualRule[];
    interactions?: InteractionSpec[];
    behaviors?: ComponentBehavior[];
    libraries?: string[];
}
