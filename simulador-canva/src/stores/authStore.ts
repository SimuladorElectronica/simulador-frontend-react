import { useSyncExternalStore } from 'react';
import { apiFetchMe, apiLogin, ApiError } from '../services/api';
import { clearStoredToken, getStoredToken, saveToken } from '../services/session';

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
 * Sesión del simulador contra el backend (JWT). El token se persiste en
 * localStorage (`simulador.session.token`) para sobrevivir a recargas.
 * `hydrate()` valida el token guardado contra GET /auth/me al montar la app;
 * si el backend dice 401, el token se descarta.
 */
class AuthStore {
    private state: AuthState = INITIAL_STATE;
    private listeners = new Set<() => void>();
    private hydratePromise: Promise<void> | null = null;

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

        this.set({ status: 'loading', user: null, error: null });
        this.hydratePromise = apiFetchMe()
            .then((user) => this.set({ status: 'authenticated', user, error: null }))
            .catch((err: unknown) => {
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

    public async login(email: string, password: string): Promise<void> {
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
        clearStoredToken();
        this.set(INITIAL_STATE);
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private set(next: AuthState) {
        this.state = next;
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
