import { useState } from 'react';
import type { FormEvent } from 'react';
import { authStore, useAuth } from '../stores/authStore';
import { DASHBOARD_URL, getDashboardHandoffUrl, hasStoredToken, isGuestMode } from '../services/session';

const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    borderRadius: 4,
    border: '1px solid #455a64',
    background: '#1c262b',
    color: '#eceff1',
    fontSize: 12,
    marginBottom: 8,
} as const;

/**
 * Panel "Cuenta" de la columna derecha.
 * - Deslogueado: formulario de inicio de sesión (el token se guarda en
 *   sessionStorage y se envía como Bearer a las llamadas autenticadas).
 * - Modo invitado con sesión guardada (plantillas en equipos compartidos):
 *   no se usa el token, pero se ofrece "Usar esa cuenta" o "Cerrar sesión".
 * - Logueado: datos del usuario, enlace al dashboard entregándole el token
 *   (fragment) y botón de cerrar sesión.
 */
export function AccountPanel() {
    const auth = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const isLoading = auth.status === 'loading';

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed || !password) return;
        void authStore.login(trimmed, password);
        setPassword('');
    };

    if (auth.status === 'authenticated' && auth.user) {
        const initials = auth.user.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('');

        return (
            <section style={{ borderBottom: '1px solid #37474f', paddingBottom: 12, marginBottom: 12 }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 13 }}>Cuenta</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div
                        aria-hidden
                        style={{
                            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 14,
                        }}
                    >
                        {initials || '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#eceff1' }}>{auth.user.name}</div>
                        <div style={{ fontSize: 10, color: '#90a4ae', wordBreak: 'break-all' }}>{auth.user.email}</div>
                        <span
                            style={{
                                display: 'inline-block', marginTop: 2, padding: '1px 6px',
                                borderRadius: 10, background: '#37474f', color: '#80cbc4', fontSize: 9,
                            }}
                        >
                            {auth.user.role}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={() => {
                            // Handoff al dashboard: token por fragment (no llega a logs del servidor)
                            window.location.assign(getDashboardHandoffUrl());
                        }}
                        style={{
                            flex: 1, padding: '7px 8px', borderRadius: 6, border: 'none',
                            background: '#5c6bc0', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                        }}
                    >
                        Ir al dashboard →
                    </button>
                    <button onClick={() => authStore.logout()} style={{ padding: '7px 10px', fontSize: 11 }}>
                        Cerrar sesión
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section style={{ borderBottom: '1px solid #37474f', paddingBottom: 12, marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 13 }}>Cuenta</h2>
            <form onSubmit={onSubmit}>
                <label htmlFor="account-email" style={{ display: 'block', fontSize: 10, color: '#90a4ae', marginBottom: 4 }}>
                    Email
                </label>
                <input
                    id="account-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="profe@demo.com"
                    style={inputStyle}
                />
                <label htmlFor="account-password" style={{ display: 'block', fontSize: 10, color: '#90a4ae', marginBottom: 4 }}>
                    Contraseña
                </label>
                <input
                    id="account-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6, border: 'none',
                        background: isLoading ? '#5c6bc0' : '#1565c0', color: '#fff',
                        fontWeight: 700, fontSize: 12, cursor: isLoading ? 'wait' : 'pointer',
                    }}
                >
                    {isLoading ? 'Validando…' : 'Iniciar sesión'}
                </button>
            </form>

            {auth.error && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#ff8a80', wordBreak: 'break-word' }}>
                    {auth.error}
                </div>
            )}

            <div style={{ marginTop: 8, fontSize: 10, color: '#90a4ae' }}>
                ¿No tenés cuenta?{' '}
                <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" style={{ color: '#80cbc4' }}>
                    Registrate en el dashboard →
                </a>
            </div>

            {isGuestMode() && hasStoredToken() && (
                <div
                    data-testid="guest-session-notice"
                    style={{
                        marginTop: 10,
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #455a64',
                        background: '#1c262b',
                        fontSize: 10,
                        color: '#b0bec5',
                        lineHeight: 1.5,
                    }}
                >
                    <div style={{ marginBottom: 6 }}>
                        Modo invitado: no se usa la sesión guardada en este equipo.
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={() => void authStore.usePersistedSession()}
                            style={{
                                flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none',
                                background: '#1565c0', color: '#fff', fontWeight: 700,
                                fontSize: 10, cursor: 'pointer',
                            }}
                        >
                            Usar esa cuenta
                        </button>
                        <button
                            onClick={() => authStore.logout()}
                            style={{ padding: '6px 10px', fontSize: 10 }}
                        >
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
