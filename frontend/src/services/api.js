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
    // No aplica a las llamadas de login/registro (ahí el 401 es "credenciales
    // inválidas" y debe mostrarse en la propia pantalla).
    const url = error.config?.url || ''
    const esLlamadaAuth =
      url.includes('/auth/login') || url.includes('/auth/registro')
    const teniaToken = localStorage.getItem(TOKEN_KEY)

    if (error.response?.status === 401 && !esLlamadaAuth && teniaToken) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }

    return Promise.reject(error)
  },
)

export default api
