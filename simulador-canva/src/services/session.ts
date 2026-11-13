/**
 * Almacenamiento del access token (localStorage) y handoff al dashboard.
 *
 * El dashboard acepta el token en `http://localhost:5174/auth/token` tanto
 * por query (`?access_token=`) como por fragment (`#access_token=`); usamos
 * el fragment: el token no queda en logs de servidores/proxies.
 */

const TOKEN_KEY = 'simulador.session.token';

export const DASHBOARD_URL: string =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ?? 'http://localhost:5174';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage no disponible (modo privado estricto, etc.)
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
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
