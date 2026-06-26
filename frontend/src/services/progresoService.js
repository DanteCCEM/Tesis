import api from './api.js'

const progresoService = {
  // GET /api/progreso/mi-progreso?cursoId=:cursoId -> { ok, progreso }
  async miProgreso(cursoId) {
    const params = cursoId != null && cursoId !== '' ? { cursoId } : undefined
    const { data } = await api.get('/progreso/mi-progreso', { params })
    return data.progreso
  },
}

export default progresoService
