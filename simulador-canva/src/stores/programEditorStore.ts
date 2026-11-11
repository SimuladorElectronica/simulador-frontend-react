import { DEFAULT_SKETCH } from '../core/editor/defaultSketch';
import { documentStore } from './documentStore';
import { sidebarStore } from './sidebarStore';

export interface ProgramEditorState {
    /** ESP32 que se está editando (null = todavía no se eligió ninguno) */
    targetMcuId: string | null;
    /** Buffer de edición actual (lo que muestra el editor) */
    source: string;
    /** Si el panel del editor está abierto (Monaco se carga al abrirlo) */
    isOpen: boolean;
}

const INITIAL_STATE: ProgramEditorState = {
    targetMcuId: null,
    source: DEFAULT_SKETCH,
    isOpen: false,
};

/**
 * Estado del editor de código, compartido entre el canvas y la columna
 * izquierda. Se actualiza desde handlers de evento (clic en un ESP32,
 * "Abrir/Cerrar editor", "Cargar programa"), nunca desde un efecto.
 *
 * Regla clave: al seleccionar un MCU con sketch guardado se carga ese
 * sketch; si el MCU no tiene programa, el buffer actual se conserva para
 * poder cargárselo tal cual.
 */
export class ProgramEditorStore {
    private state: ProgramEditorState = INITIAL_STATE;
    private listeners = new Set<() => void>();

    private emit() {
        this.listeners.forEach((listener) => listener());
    }

    public getState(): ProgramEditorState {
        return this.state;
    }

    /**
     * Fija el ESP32 objetivo. Si cambia de placa y ésta tiene sketch
     * guardado, lo carga; si no tiene, deja el contenido como está.
     * También abre el editor y muestra la pestaña de código.
     */
    public selectMcu(mcuId: string) {
        sidebarStore.setTab('code');

        if (this.state.targetMcuId === mcuId) {
            // Misma placa: solo asegurar que el editor esté visible.
            if (!this.state.isOpen) {
                this.state = { ...this.state, isOpen: true };
                this.emit();
            }
            return;
        }

        const program = documentStore
            .getDocument()
            .programs.find((p) => p.mcuComponentId === mcuId);

        this.state = {
            targetMcuId: mcuId,
            source: program ? program.source : this.state.source,
            isOpen: true,
        };
        this.emit();
    }

    public setSource(source: string) {
        if (this.state.source === source) return;
        this.state = { ...this.state, source };
        this.emit();
    }

    public open() {
        if (this.state.isOpen) return;
        this.state = { ...this.state, isOpen: true };
        this.emit();
    }

    public close() {
        if (!this.state.isOpen) return;
        this.state = { ...this.state, isOpen: false };
        this.emit();
    }

    /** Solo para tests: vuelve al estado inicial. */
    public reset() {
        this.state = INITIAL_STATE;
        this.emit();
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

export const programEditorStore = new ProgramEditorStore();
