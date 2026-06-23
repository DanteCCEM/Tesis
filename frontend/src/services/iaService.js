import api from './api.js'

const iaService = {
  // POST /api/ia/generar-preguntas -> { ok, borrador, preguntas, ... }
  async generarPreguntas(payload) {
    const { data } = await api.post('/ia/generar-preguntas', payload)
    return data
  },

  // POST /api/ia/generar-retroalimentacion -> { ok, retroalimentacion, ... }
  async generarRetroalimentacion(payload) {
    const { data } = await api.post('/ia/generar-retroalimentacion', payload)
    return data
  },
}

export default iaService
