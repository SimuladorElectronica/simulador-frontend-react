import { authStore, useAuth } from '../stores/authStore';
import { hasStoredToken, isGuestMode } from '../services/session';
import { SignedInAccountView } from './account/SignedInAccountView';
import { LoginForm } from './account/LoginForm';
import { GuestSessionNotice } from './account/GuestSessionNotice';

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

    if (auth.status === 'authenticated' && auth.user) {
        return (
            <SignedInAccountView
                user={auth.user}
                onLogout={() => authStore.logout()}
            />
        );
    }

    return (
        <LoginForm isLoading={auth.status === 'loading'} error={auth.error}>
            {isGuestMode() && hasStoredToken() && <GuestSessionNotice />}
        </LoginForm>
    );
}
