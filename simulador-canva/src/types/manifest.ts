export type ElectricalPrimitiveType =
    | 'groundRef'
    | 'voltageSource'
    | 'gpio'
    | 'resistor'
    | 'led'
    | 'switch'
    | 'potentiometer';

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
    parameters?: Record<string, { type: 'number' | 'enum' | 'boolean'; min?: number; max?: number; default: any }>;
    observables?: string[];
    visualRules?: Array<{ observable: string; property: string; mapping: any }>;
    interactions?: Array<{ name: string; gesture: 'click' | 'drag' }>;
    libraries?: string[];
}