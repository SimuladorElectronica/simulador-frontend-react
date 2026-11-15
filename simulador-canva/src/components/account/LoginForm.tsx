import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { authStore } from '../../stores/authStore';
import { DASHBOARD_URL } from '../../services/session';
import {
    errorStyle,
    headingStyle,
    inputStyle,
    labelStyle,
    registerHintStyle,
    registerLinkStyle,
    sectionStyle,
    submitButtonStyle,
} from './accountStyles';

interface LoginFormProps {
    isLoading: boolean;
    error: string | null;
    children?: ReactNode;
}

/** Formulario de inicio de sesión para visitantes sin sesión. */
export function LoginForm({ isLoading, error, children }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed || !password) return;
        void authStore.login(trimmed, password);
        setPassword('');
    };

    return (
        <section style={sectionStyle}>
            <h2 style={headingStyle}>Cuenta</h2>
            <form onSubmit={onSubmit}>
                <label htmlFor="account-email" style={labelStyle}>
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
                <label htmlFor="account-password" style={labelStyle}>
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
                <button type="submit" disabled={isLoading} style={submitButtonStyle(isLoading)}>
                    {isLoading ? 'Validando…' : 'Iniciar sesión'}
                </button>
            </form>

            {error && <div style={errorStyle}>{error}</div>}

            <div style={registerHintStyle}>
                ¿No tenés cuenta?{' '}
                <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" style={registerLinkStyle}>
                    Registrate en el dashboard →
                </a>
            </div>

            {children}
        </section>
    );
}
