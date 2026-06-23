import api, { TOKEN_KEY, USER_KEY } from './api.js'

// Guarda token y usuario en localStorage para usarlos en toda la app.
const guardarSesion = (token, usuario) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  }
  if (usuario) {
    localStorage.setItem(USER_KEY, JSON.stringify(usuario))
  }
}

const authService = {
  // POST /api/auth/login -> { ok, token, usuario }
  async login({ correo, contrasena }) {
    const { data } = await api.post('/auth/login', { correo, contrasena })
    guardarSesion(data.token, data.usuario)
    return data
  },

  // POST /api/auth/registro -> { ok, usuario }
  async registro({ nombres, correo, contrasena, rol }) {
    const { data } = await api.post('/auth/registro', {
      nombres,
      correo,
      contrasena,
      rol,
    })
    return data
  },

  // GET /api/auth/perfil -> { ok, usuario } (requiere token)
  async obtenerPerfil() {
    const { data } = await api.get('/auth/perfil')
    return data.usuario
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  },

  getUsuario() {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  setUsuario(usuario) {
    if (usuario) {
      localStorage.setItem(USER_KEY, JSON.stringify(usuario))
    }
  },
}

export default authService
