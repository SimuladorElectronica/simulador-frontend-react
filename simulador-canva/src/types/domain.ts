export interface PinReference {
    componentId: string;
    pinId: string; // ID local del manifiesto
}

export interface Wire {
    id: string;
    from: PinReference;
    to: PinReference;
    color?: string;
}

export interface ComponentInstance {
    id: string;
    type: string; // ej: "core/led@1"
    position: { x: number; y: number };
    params: Record<string, number | string | boolean>;
    label?: string;
}

export interface ProgramDocument {
    mcuComponentId: string;
    language: 'cpp-subset';
    languageVersion: string;
    source: string;
}

export interface CircuitDocument {
    formatVersion: number;
    components: ComponentInstance[];
    wires: Wire[];
    programs: ProgramDocument[];
    meta: { name: string; createdAt: number; updatedAt: number };
    embeddedManifests?: Record<string, unknown>[];
}

// Proyección de simulación aislada enviada al Worker
export interface SimulationProjection {
    components: Array<Pick<ComponentInstance, 'id' | 'type' | 'params'>>;
    wires: Wire[];
    programs: ProgramDocument[];
}