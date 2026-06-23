import api from './api.js'

const practicasAdaptativasService = {
  // POST /api/practicas-adaptativas/generar -> { ok, practica, evaluacionId, resumen }
  async generar(payload = {}) {
    const { data } = await api.post('/practicas-adaptativas/generar', payload)
    return data
  },
}

export default practicasAdaptativasService
