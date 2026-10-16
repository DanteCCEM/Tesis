import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const TOKEN_KEY = 'token'
export const USER_KEY = 'usuario'

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Adjunta el token (si existe) como Authorization: Bearer TOKEN.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Normaliza los errores para exponer siempre el mensaje real del backend.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const respuesta = error.response?.data
    const mensaje =
      respuesta?.error ||
      respuesta?.message ||
      error.message ||
      'No se pudo conectar con el servidor.'

    error.mensaje = mensaje

    // Sesión expirada o token inválido: limpiamos la sesión y enviamos al login.
    // No aplica al login: allí el 401 significa "credenciales inválidas" y
    // debe mostrarse en la propia pantalla.
    const url = error.config?.url || ''
    const esLlamadaAuth = url.includes('/auth/login')
    const teniaToken = localStorage.getItem(TOKEN_KEY)

    if (error.response?.status === 401 && !esLlamadaAuth && teniaToken) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }

    if (
      error.response?.status === 403 &&
      respuesta?.code === 'PASSWORD_CHANGE_REQUIRED' &&
      teniaToken
    ) {
      const raw = localStorage.getItem(USER_KEY)
      try {
        const usuario = JSON.parse(raw)
        localStorage.setItem(
          USER_KEY,
          JSON.stringify({ ...usuario, debeCambiarPassword: true }),
        )
      } catch {
        // La ruta protegida volverá a validar la sesión almacenada.
      }
      if (window.location.pathname !== '/cambiar-password') {
        window.location.assign('/cambiar-password')
      }
    }

    return Promise.reject(error)
  },
)

export default api
