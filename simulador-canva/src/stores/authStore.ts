import { useSyncExternalStore } from 'react';
import { apiFetchMe, apiLogin, ApiError } from '../services/api';
import {
    clearStoredToken,
    enterGuestMode,
    exitGuestMode,
    getStoredToken,
    saveToken,
} from '../services/session';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

export interface AuthState {
    status: AuthStatus;
    user: AuthUser | null;
    error: string | null;
}

const INITIAL_STATE: AuthState = { status: 'idle', user: null, error: null };

/**
 * Sesión del simulador contra el backend (JWT). El token se guarda en
 * `sessionStorage` (ver services/session.ts): sobrevive recargas de la
 * pestaña, no al cierre del navegador. `hydrate()` valida el token guardado
 * contra GET /auth/me; si el backend dice 401, el token se descarta.
 *
 * Modo invitado (`useGuestSession`): las rutas de plantillas ignoran el token
 * guardado por defecto (seguro en equipos compartidos). `usePersistedSession`
 * lo recupera cuando la persona elige explícitamente "usar esa cuenta".
 */
class AuthStore {
    private state: AuthState = INITIAL_STATE;
    private listeners = new Set<() => void>();
    private hydratePromise: Promise<void> | null = null;
    /** Cambia al entrar/salir de invitado o cerrar sesión: invalida hydrates en vuelo. */
    private epoch = 0;

    public getState(): AuthState {
        return this.state;
    }

    public isAuthenticated(): boolean {
        return this.state.status === 'authenticated';
    }

    /** Valida (si hay) el token guardado. Idempotente: llamadas concurrentes comparten la promesa. */
    public hydrate(): Promise<void> {
        if (this.hydratePromise) return this.hydratePromise;

        const token = getStoredToken();
        if (!token) {
            this.set(INITIAL_STATE);
            return Promise.resolve();
        }

        const epoch = this.epoch;
        this.set({ status: 'loading', user: null, error: null });
        this.hydratePromise = apiFetchMe()
            .then((user) => {
                if (this.epoch === epoch) this.set({ status: 'authenticated', user, error: null });
            })
            .catch((err: unknown) => {
                if (this.epoch !== epoch) return;
                if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
                    clearStoredToken();
                    this.set({
                        status: 'error',
                        user: null,
                        error: 'La sesión venció o no es válida. Iniciá sesión nuevamente.',
                    });
                } else {
                    // Sin conexión / backend caído: conservamos el token por si fue un fallo transitorio
                    this.set({
                        status: 'error',
                        user: null,
                        error: 'No se pudo validar la sesión con el backend. Se reintentará al recargar.',
                    });
                }
            })
            .finally(() => {
                this.hydratePromise = null;
            });
        return this.hydratePromise;
    }

    /**
     * Modo invitado: ignora el token guardado durante esta pestaña (no lo
     * borra). Ninguna llamada autenticada usará la sesión de otra persona.
     */
    public useGuestSession(): void {
        this.epoch += 1;
        enterGuestMode();
        this.set(INITIAL_STATE);
    }

    /**
     * Vuelve a usar el token guardado (elección explícita "usar esa cuenta").
     * Si ya hay una sesión autenticada en memoria, no vuelve a llamar al backend.
     */
    public async usePersistedSession(): Promise<void> {
        exitGuestMode();
        if (this.isAuthenticated()) return;
        if (this.hydratePromise) {
            await this.hydratePromise;
            if (this.isAuthenticated()) return;
        }
        await this.hydrate();
    }

    public async login(email: string, password: string): Promise<void> {
        this.epoch += 1;
        this.set({ status: 'loading', user: null, error: null });
        try {
            const token = await apiLogin(email, password);
            saveToken(token);
            const user = await apiFetchMe();
            this.set({ status: 'authenticated', user, error: null });
        } catch (err) {
            clearStoredToken();
            this.set({
                status: 'error',
                user: null,
                error: err instanceof Error ? err.message : 'No se pudo iniciar sesión.',
            });
        }
    }

    public logout() {
        this.epoch += 1;
        clearStoredToken();
        this.set(INITIAL_STATE);
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private set(next: AuthState) {
        // Copia nueva: useSyncExternalStore solo re-renderiza si cambia la referencia.
        this.state = { ...next };
        this.listeners.forEach((listener) => listener());
    }
}

export const authStore = new AuthStore();

export function useAuth(): AuthState {
    return useSyncExternalStore(
        (onChange) => authStore.subscribe(onChange),
        () => authStore.getState(),
    );
}
