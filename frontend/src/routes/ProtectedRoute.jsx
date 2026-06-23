import { Navigate, Outlet } from 'react-router-dom'
import authService from '../services/authService.js'

// Protege un grupo de rutas: exige sesión válida y, opcionalmente, un rol.
// - Sin token/usuario -> redirige a /login.
// - Rol incorrecto -> redirige al panel que corresponde al usuario.
function ProtectedRoute({ role }) {
  const token = authService.getToken()
  const usuario = authService.getUsuario()

  if (!token || !usuario) {
    return <Navigate to="/login" replace />
  }

  if (role && usuario.rol !== role) {
    const destino =
      usuario.rol === 'DOCENTE'
        ? '/docente/dashboard'
        : '/estudiante/dashboard'
    return <Navigate to={destino} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
