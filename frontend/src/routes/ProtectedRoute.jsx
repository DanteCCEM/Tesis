import { Navigate, Outlet } from 'react-router-dom'
import authService from '../services/authService.js'

// Protege un grupo de rutas: exige sesión válida y, opcionalmente, un rol.
// - Sin token/usuario -> redirige a /login.
// - Rol incorrecto -> redirige al panel que corresponde al usuario.
function ProtectedRoute({ role, allowPasswordChange = false }) {
  const token = authService.getToken()
  const usuario = authService.getUsuario()

  if (!token || !usuario) {
    return <Navigate to="/login" replace />
  }

  if (usuario.debeCambiarPassword && !allowPasswordChange) {
    return <Navigate to="/cambiar-password" replace />
  }

  if (role && usuario.rol !== role) {
    const destino = usuario.rol === 'DOCENTE'
      ? '/docente/dashboard'
      : usuario.rol === 'ESTUDIANTE'
        ? '/estudiante/dashboard'
        : '/admin/dashboard'
    return <Navigate to={destino} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
