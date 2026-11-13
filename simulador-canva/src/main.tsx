import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import { TemplatesPage } from './UIcomponents/TemplatesPage'
import './index.css'

// Rutas (ninguna pasa por un guard de login; todo funciona en modo invitado):
//   /              → simulador vacío
//   /p/:slug       → simulador con el circuito compartido (shareSlug de 6 chars)
//   /share/:slug   → alias: es la URL que genera el backend por defecto (FRONTEND_URL + /share/{slug})
//   /session/:token → simulador con una sesión ya iniciada (guarda el token y redirige a /)
//   /new           → simulador en blanco (lienzo vacío, sin proyecto recordado); acepta ?new=1 en cualquier ruta
//   /plantillas    → catálogo público de plantillas (sin sesión)
//   /plantillas/:slug → plantilla como copia editable en memoria (sin sesión)
const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/p/:slug', element: <App /> },
  { path: '/share/:slug', element: <App /> },
  { path: '/session/:token', element: <App /> },
  { path: '/new', element: <App /> },
  { path: '/plantillas', element: <TemplatesPage /> },
  { path: '/plantillas/:slug', element: <App /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
