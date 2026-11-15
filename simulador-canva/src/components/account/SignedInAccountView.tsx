import type { AuthUser } from '../../stores/authStore';
import { getDashboardHandoffUrl } from '../../services/session';
import {
    actionsRowStyle,
    avatarStyle,
    dashboardButtonStyle,
    headingStyle,
    initialsOf,
    logoutButtonStyle,
    roleBadgeStyle,
    sectionStyle,
    userEmailStyle,
    userNameStyle,
    userRowStyle,
} from './accountStyles';

interface SignedInAccountViewProps {
    user: AuthUser;
    onLogout: () => void;
}

/** Vista de la cuenta cuando hay una sesión autenticada. */
export function SignedInAccountView({ user, onLogout }: SignedInAccountViewProps) {
    return (
        <section style={sectionStyle}>
            <h2 style={headingStyle}>Cuenta</h2>
            <div style={userRowStyle}>
                <div aria-hidden style={avatarStyle}>
                    {initialsOf(user.name) || '?'}
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={userNameStyle}>{user.name}</div>
                    <div style={userEmailStyle}>{user.email}</div>
                    <span style={roleBadgeStyle}>{user.role}</span>
                </div>
            </div>
            <div style={actionsRowStyle}>
                <button
                    onClick={() => {
                        // Handoff al dashboard: token por fragment (no llega a logs del servidor)
                        window.location.assign(getDashboardHandoffUrl());
                    }}
                    style={dashboardButtonStyle}
                >
                    Ir al dashboard →
                </button>
                <button onClick={onLogout} style={logoutButtonStyle}>
                    Cerrar sesión
                </button>
            </div>
        </section>
    );
}
