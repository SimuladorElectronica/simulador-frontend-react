import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authStore } from '../../stores/authStore';
import { hasStoredToken } from '../../services/session';
import {
    closeSessionButtonStyle,
    headerActionsStyle,
    headerRowStyle,
    openLinkStyle,
    titleStyle,
} from './templatesStyles';

/** Título, cierre de sesión opcional y enlace de vuelta al simulador. */
export function TemplatesHeader() {
    // El catálogo es público, pero en equipos compartidos ofrecemos cerrar la
    // sesión guardada (sessionStorage) desde acá también.
    const [hasSession, setHasSession] = useState(() => hasStoredToken());

    const closeSession = () => {
        authStore.logout();
        setHasSession(false);
    };

    return (
        <div style={headerRowStyle}>
            <h1 style={titleStyle}>Plantillas del simulador</h1>
            <div style={headerActionsStyle}>
                {hasSession && (
                    <button
                        onClick={closeSession}
                        title="Elimina la sesión guardada en este equipo"
                        style={closeSessionButtonStyle}
                    >
                        Cerrar sesión
                    </button>
                )}
                <Link to="/" style={openLinkStyle}>
                    Abrir simulador →
                </Link>
            </div>
        </div>
    );
}
