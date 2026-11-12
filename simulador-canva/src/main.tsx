import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Rutas:
//   /              → simulador vacío
//   /p/:slug       → simulador con el circuito compartido (shareSlug de 6 chars)
//   /share/:slug   → alias: es la URL que genera el backend por defecto (FRONTEND_URL + /share/{slug})
//   /session/:token → simulador con una sesión ya iniciada (guarda el token y redirige a /)
const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/p/:slug', element: <App /> },
  { path: '/share/:slug', element: <App /> },
  { path: '/session/:token', element: <App /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
