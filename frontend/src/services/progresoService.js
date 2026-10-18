import api from './api.js'

const progresoService = {
  // GET /api/progreso/mi-progreso?cursoId=:cursoId -> { ok, progreso }
  async miProgreso(cursoId) {
    const params = cursoId != null && cursoId !== '' ? { cursoId } : undefined
    const { data } = await api.get('/progreso/mi-progreso', { params })
    return data.progreso
  },

  async miEvolucion(params = {}) {
    const { data } = await api.get('/progreso/evolucion', { params })
    return data.evolucion
  },

  async evolucionEstudianteAsignacion(asignacionCursoId, estudianteId, params = {}) {
    const { data } = await api.get(
      `/progreso/docente/asignaciones/${asignacionCursoId}/estudiantes/${estudianteId}/evolucion`,
      { params },
    )
    return data.evolucion
  },

  async evolucionEstudianteAdmin(estudianteId, params = {}) {
    const { data } = await api.get(
      `/progreso/admin/estudiantes/${estudianteId}/evolucion`,
      { params },
    )
    return data.evolucion
  },
}

export default progresoService
