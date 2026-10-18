import api from './api.js'

const IA_TIMEOUT_MS = 120000

const iaService = {
  // POST /api/ia/generar-variantes -> tres variantes revisables
  async generarVariantes(payload) {
    const { data } = await api.post('/ia/generar-variantes', payload, {
      timeout: IA_TIMEOUT_MS * 3,
    })
    return data
  },

  // POST /api/ia/generar-preguntas -> { ok, borrador, preguntas, ... }
  async generarPreguntas(payload) {
    const { data } = await api.post('/ia/generar-preguntas', payload, {
      timeout: IA_TIMEOUT_MS,
    })
    return data
  },

  // POST /api/ia/generar-retroalimentacion -> { ok, retroalimentacion, ... }
  async generarRetroalimentacion(payload) {
    const { data } = await api.post('/ia/generar-retroalimentacion', payload, {
      timeout: IA_TIMEOUT_MS,
    })
    return data
  },
}

export default iaService
