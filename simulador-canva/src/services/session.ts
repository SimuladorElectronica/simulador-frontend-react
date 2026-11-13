/**
 * Almacenamiento del access token y handoff al dashboard.
 *
 * El token vive en `sessionStorage` (no en localStorage): sobrevive a
 * recargas de la pestaña pero NO al cierre del navegador ni se comparte entre
 * pestañas. En equipos compartidos la sesión no queda persistida en disco.
 * Al cargar el módulo se elimina el token legado que versiones anteriores
 * guardaban en localStorage.
 *
 * Modo invitado (plantillas / enlaces públicos): `enterGuestMode()` hace que
 * `getStoredToken()` devuelva null aunque haya un token guardado, de modo que
 * NINGUNA llamada autenticada (guardado, /auth/me) use la sesión de otra
 * persona. `peekStoredToken()` sigue viendo el token para ofrecer
 * explícitamente "usar esa cuenta". El modo es por pestaña y en memoria.
 *
 * El dashboard acepta el token en `http://localhost:5174/auth/token` tanto
 * por query (`?access_token=`) como por fragment (`#access_token=`); usamos
 * el fragment: el token no queda en logs de servidores/proxies.
 */

const TOKEN_KEY = 'simulador.session.token';

export const DASHBOARD_URL: string =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ?? 'http://localhost:5173';

// Limpieza del token legado (localStorage) de versiones anteriores.
try {
  localStorage.removeItem(TOKEN_KEY);
} catch {
  // localStorage no disponible: nada que limpiar
}

/** Si es true, esta pestaña navega como invitada e ignora el token guardado. */
let guestMode = false;

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Token para las llamadas autenticadas: null en modo invitado. */
export function getStoredToken(): string | null {
  if (guestMode) return null;
  return readToken();
}

/**
 * Token guardado en el equipo, aunque la pestaña esté en modo invitado.
 * Sirve para ofrecer "usar esa cuenta" / "cerrar sesión" sin usarla.
 */
export function peekStoredToken(): string | null {
  return readToken();
}

/** true si hay una sesión guardada en este equipo (aunque estemos invitados). */
export function hasStoredToken(): boolean {
  return readToken() !== null;
}

export function isGuestMode(): boolean {
  return guestMode;
}

/** Ignora el token guardado durante esta pestaña (modo invitado explícito). */
export function enterGuestMode(): void {
  guestMode = true;
}

/** Vuelve a permitir el uso del token guardado. */
export function exitGuestMode(): void {
  guestMode = false;
}

export function saveToken(token: string): void {
  // Iniciar sesión siempre sale del modo invitado.
  guestMode = false;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // sessionStorage no disponible (modo privado estricto, etc.)
  }
}

export function clearStoredToken(): void {
  guestMode = false;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // idem
  }
}

/** URL para abrir el dashboard ya autenticado (entregamos el token por fragment). */
export function getDashboardHandoffUrl(): string {
  const token = getStoredToken();
  return token
    ? `${DASHBOARD_URL}/auth/token#access_token=${encodeURIComponent(token)}`
    : DASHBOARD_URL;
}
