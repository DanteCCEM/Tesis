import api from './api.js'

const intentosService = {
  // GET /api/intentos/:intentoId/resultados -> { ok, resultado }
  async obtenerResultados(intentoId) {
    const { data } = await api.get(`/intentos/${intentoId}/resultados`)
    return data.resultado
  },

  // POST /api/intentos/:intentoId/respuestas -> { ok, respuesta }
  async guardarRespuesta(intentoId, payload) {
    const { data } = await api.post(`/intentos/${intentoId}/respuestas`, payload)
    return data.respuesta
  },

  // POST /api/intentos/:intentoId/finalizar -> { ok, resultado }
  async finalizar(intentoId) {
    const { data } = await api.post(`/intentos/${intentoId}/finalizar`)
    return data.resultado
  },
}

export default intentosService
