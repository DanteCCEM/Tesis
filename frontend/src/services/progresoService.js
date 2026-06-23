import api from './api.js'

const progresoService = {
  // GET /api/progreso/mi-progreso -> { ok, progreso }
  async miProgreso() {
    const { data } = await api.get('/progreso/mi-progreso')
    return data.progreso
  },
}

export default progresoService
