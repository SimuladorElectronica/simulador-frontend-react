import { useState } from 'react';
import { authStore } from '../../stores/authStore';
import {
    guestActionsStyle,
    guestLogoutButtonStyle,
    guestNoticeStyle,
    useAccountButtonStyle,
} from './accountStyles';

/** Aviso para equipos compartidos: hay una sesión guardada que no se usa. */
export function GuestSessionNotice() {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const closeSession = () => {
        setDismissed(true);
        authStore.logout();
    };

    return (
        <div data-testid="guest-session-notice" style={guestNoticeStyle}>
            <div style={{ marginBottom: 6 }}>
                Modo invitado: no se usa la sesión guardada en este equipo.
            </div>
            <div style={guestActionsStyle}>
                <button
                    onClick={() => void authStore.usePersistedSession()}
                    style={useAccountButtonStyle}
                >
                    Usar esa cuenta
                </button>
                <button onClick={closeSession} style={guestLogoutButtonStyle}>
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}
