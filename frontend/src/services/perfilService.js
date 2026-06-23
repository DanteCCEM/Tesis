import api from './api.js'

const perfilService = {
  // GET /api/perfil -> { ok, perfil }
  async obtenerMiPerfil() {
    const { data } = await api.get('/perfil')
    return data.perfil
  },

  // PUT /api/perfil -> { ok, perfil }
  async actualizarMiPerfil(payload) {
    const { data } = await api.put('/perfil', payload)
    return data.perfil
  },

  // GET /api/usuarios/:id/perfil -> { ok, perfil, esPropio }
  async obtenerPerfilUsuario(usuarioId) {
    const { data } = await api.get(`/usuarios/${usuarioId}/perfil`)
    return data
  },
}

export default perfilService
