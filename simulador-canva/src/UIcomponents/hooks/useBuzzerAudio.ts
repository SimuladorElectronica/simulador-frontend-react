import { useEffect } from 'react';

/* ======================================================================== */
/*  Audio del zumbador (Buzzer)                                               */
/*                                                                           */
/*  El buzzer del simulador se controla con la misma señal eléctrica que un   */
/*  buzz real: mientras el Worker reporta tensión ≥ 0.5 V en el componente    */
/*  (`observable on` del netlist) sonaba. Ahora ese estado enciende un         */
/*  tono continuo por Web Audio API mientras dure.                           */
/*                                                                           */
/*  - El tono es una onda cuadrada (~2 kHz, sonido clásico de buzzer).        */
/*  - El Gain se suaviza (fade-in/out) para evitar clics de arranque.         */
/*  - El AudioContext se crea perezosamente y se "desbloquea" con el primer   */
/*    evento de pointer/keyboard (requerido por el navegador).               */
/*  - Si el navegador no soporta Web Audio (jsdom, etc.) se ignora silenciosamente. */
/* ======================================================================== */

const BUZZER_MANIFEST_ID = 'core/buzzer@1';
const BUZZER_FREQUENCY = 2048; // Hz (onda cuadrada)
const BUZZER_GAIN = 0.05; // volumen (0-1) del tono

interface ActiveBuzzer {
    oscillator: OscillatorNode;
    gain: GainNode;
}

class BuzzerAudioManager {
    private ctx: AudioContext | null = null;
    private active = new Map<string, ActiveBuzzer>();
    private unlockListener: (() => void) | null = null;

    private ensureContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        const Ctor = typeof window.AudioContext !== 'undefined' ? window.AudioContext : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        if (!this.ctx) {
            try {
                this.ctx = new Ctor();
            } catch {
                return null;
            }
        }
        if (this.ctx.state === 'suspended') {
            void this.ctx.resume().catch(() => {
                // Sin audio: no hacer nada, la UI sigue funcionando.
            });
        }
        return this.ctx;
    }

    /** Desbloquea el AudioContext con el primer gesto del usuario (requerido por Chrome/Safari). */
    installUnlockListener(): void {
        if (this.unlockListener) return;
        const resume = () => {
            this.ensureContext();
            window.removeEventListener('pointerdown', resume);
            window.removeEventListener('keydown', resume);
            this.unlockListener = null;
        };
        window.addEventListener('pointerdown', resume);
        window.addEventListener('keydown', resume);
        this.unlockListener = resume;
    }

    setBuzzer(componentId: string, on: boolean): void {
        if (on) this.activate(componentId);
        else this.deactivate(componentId);
    }

    private activate(componentId: string): void {
        if (this.active.has(componentId)) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        try {
            const oscillator = ctx.createOscillator();
            oscillator.type = 'square';
            oscillator.frequency.value = BUZZER_FREQUENCY;
            const gain = ctx.createGain();
            gain.gain.value = 0;
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            // Fade-in suave para evitar un clic instantáneo agudo.
            const now = ctx.currentTime;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(BUZZER_GAIN, now + 0.015);
            this.active.set(componentId, { oscillator, gain });
        } catch {
            // Sin audio disponible: ignorar, no romper la app.
        }
    }

    private deactivate(componentId: string): void {
        const entry = this.active.get(componentId);
        if (!entry) return;
        this.active.delete(componentId);
        const ctx = this.ctx;
        try {
            if (ctx) {
                entry.gain.gain.cancelScheduledValues(ctx.currentTime);
                entry.gain.gain.setValueAtTime(entry.gain.gain.value, ctx.currentTime);
                entry.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
                window.setTimeout(() => {
                    try {
                        entry.oscillator.stop();
                    } catch {
                        // Ya parado: no hacer nada.
                    }
                    try {
                        entry.oscillator.disconnect();
                        entry.gain.disconnect();
                    } catch {
                        // Silenciar errores de cleanup.
                    }
                }, 40);
            } else {
                entry.oscillator.stop();
            }
        } catch {
            try {
                entry.oscillator.stop();
            } catch {
                // Silenciar errores de cleanup.
            }
        }
    }
}

export const buzzerAudio = new BuzzerAudioManager();

/**
 * Gestiona el tono del buzzer para una instancia del componente con id `manifestId`.
 *
 * - `componentId`: id de la instancia en el canvas (clave del manager).
 * - `manifestId`: id del manifiesto (sólo el `core/buzzer@1` emite audio).
 * - `on`: valor del observable `on` del Worker (true → suena, false → silencio).
 */
export function useBuzzerAudio(componentId: string | undefined, manifestId: string | undefined, on: boolean): void {
    useEffect(() => {
        buzzerAudio.installUnlockListener();
        if (!componentId || manifestId !== BUZZER_MANIFEST_ID) return;
        buzzerAudio.setBuzzer(componentId, on);
        return () => buzzerAudio.setBuzzer(componentId, false);
    }, [componentId, manifestId, on]);
}
