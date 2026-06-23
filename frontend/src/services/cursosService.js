import api from './api.js'

const cursosService = {
  // GET /api/cursos/mis-cursos -> { ok, cursos }
  async misCursos() {
    const { data } = await api.get('/cursos/mis-cursos')
    return data.cursos
  },

  // POST /api/cursos -> { ok, curso }
  async crear({ nombre, grado, seccion, descripcion }) {
    const { data } = await api.post('/cursos', {
      nombre,
      grado,
      seccion,
      descripcion,
    })
    return data.curso
  },

  // POST /api/cursos/:id/matriculas -> { ok, matricula }
  async matricular(cursoId, { correo, estudianteId }) {
    const { data } = await api.post(`/cursos/${cursoId}/matriculas`, {
      correo,
      estudianteId,
    })
    return data.matricula
  },

  // GET /api/cursos/:id -> { ok, curso }
  async detalle(cursoId) {
    const { data } = await api.get(`/cursos/${cursoId}`)
    return data.curso
  },

  // GET /api/cursos/:id/resumen-estudiantes -> { ok, estudiantes }
  async resumenEstudiantes(cursoId) {
    const { data } = await api.get(`/cursos/${cursoId}/resumen-estudiantes`)
    return data.estudiantes
  },

  // DELETE /api/cursos/:id/matriculas/:estudianteId -> { ok, mensaje, estudiantes }
  async eliminarMatricula(cursoId, estudianteId) {
    const { data } = await api.delete(
      `/cursos/${cursoId}/matriculas/${estudianteId}`,
    )
    return data
  },
}

export default cursosService
