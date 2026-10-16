import api from './api.js'

const cursosService = {
  async misCursos() {
    const { data } = await api.get('/cursos/mis-cursos')
    return data.cursos
  },
  async detalle(cursoId) {
    const { data } = await api.get(`/cursos/${cursoId}`)
    return data.curso
  },
  async resumenEstudiantes(cursoId) {
    const { data } = await api.get(`/cursos/${cursoId}/resumen-estudiantes`)
    return data.estudiantes
  },
}

export default cursosService
