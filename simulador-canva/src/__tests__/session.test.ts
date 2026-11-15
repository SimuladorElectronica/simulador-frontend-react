// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    clearStoredToken,
    enterGuestMode,
    exitGuestMode,
    getStoredToken,
    hasStoredToken,
    isGuestMode,
    peekStoredToken,
    saveToken,
} from '../services/session';

const TOKEN_KEY = 'simulador.session.token';

describe('session (token en sessionStorage + modo invitado)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
        exitGuestMode();
    });

    afterEach(() => {
        clearStoredToken();
        sessionStorage.clear();
        localStorage.clear();
    });

    it('guarda el token en sessionStorage (no en localStorage: equipos compartidos)', () => {
        saveToken('jwt-123');
        expect(sessionStorage.getItem(TOKEN_KEY)).toBe('jwt-123');
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
        expect(getStoredToken()).toBe('jwt-123');
    });

    it('el modo invitado ignora el token para las llamadas autenticadas sin borrarlo', () => {
        saveToken('jwt-123');
        enterGuestMode();

        expect(isGuestMode()).toBe(true);
        expect(getStoredToken()).toBeNull();
        // La sesión sigue disponible para ofrecer "usar esa cuenta"
        expect(peekStoredToken()).toBe('jwt-123');
        expect(hasStoredToken()).toBe(true);
        expect(sessionStorage.getItem(TOKEN_KEY)).toBe('jwt-123');
    });

    it('salir del modo invitado (o guardar/borrar token) vuelve a usar la sesión', () => {
        saveToken('jwt-123');
        enterGuestMode();
        exitGuestMode();
        expect(getStoredToken()).toBe('jwt-123');

        enterGuestMode();
        saveToken('jwt-456');
        expect(isGuestMode()).toBe(false);
        expect(getStoredToken()).toBe('jwt-456');

        enterGuestMode();
        clearStoredToken();
        expect(isGuestMode()).toBe(false);
        expect(getStoredToken()).toBeNull();
        expect(hasStoredToken()).toBe(false);
    });

    it('limpia el token legado de localStorage al cargar el módulo', async () => {
        localStorage.setItem(TOKEN_KEY, 'token-viejo-en-disco');
        vi.resetModules();

        const fresh = await import('../services/session');

        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
        expect(fresh.getStoredToken()).toBeNull();
    });
});
