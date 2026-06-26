import api from './api.js'

const planCurricularService = {
  async listarPorCurso(cursoId) {
    const { data } = await api.get(`/cursos/${cursoId}/plan-curricular`)
    return data.planes ?? []
  },

  async subirPlan(cursoId, { periodo, archivo }) {
    const formData = new FormData()
    formData.append('periodo', periodo)
    formData.append('archivo', archivo)

    const { data } = await api.post(
      `/cursos/${cursoId}/plan-curricular`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data.plan
  },

  async obtenerPlan(planId) {
    const { data } = await api.get(`/plan-curricular/${planId}`)
    return data.plan
  },

  async actualizarPlan(planId, payload) {
    const { data } = await api.put(`/plan-curricular/${planId}`, payload)
    return data.plan
  },

  async procesarPdf(planId, { confirmarReemplazo = false } = {}) {
    const { data } = await api.post(`/plan-curricular/${planId}/procesar-pdf`, {
      confirmarReemplazo,
    })
    return data
  },

  async publicar(planId) {
    const { data } = await api.put(`/plan-curricular/${planId}/publicar`)
    return data.plan
  },

  async crearUnidad(planId, payload) {
    const { data } = await api.post(`/plan-curricular/${planId}/unidades`, payload)
    return data.unidad
  },

  async actualizarUnidad(unidadId, payload) {
    const { data } = await api.put(`/unidades-curriculares/${unidadId}`, payload)
    return data.unidad
  },

  async eliminarUnidad(unidadId) {
    const { data } = await api.delete(`/unidades-curriculares/${unidadId}`)
    return data
  },

  async crearTema(unidadId, payload) {
    const { data } = await api.post(`/unidades-curriculares/${unidadId}/temas`, payload)
    return data.tema
  },

  async actualizarTema(temaId, payload) {
    const { data } = await api.put(`/temas-curriculares/${temaId}`, payload)
    return data.tema
  },

  async eliminarTema(temaId) {
    const { data } = await api.delete(`/temas-curriculares/${temaId}`)
    return data
  },

  async crearSubtema(temaId, payload) {
    const { data } = await api.post(`/temas-curriculares/${temaId}/subtemas`, payload)
    return data.subtema
  },

  async actualizarSubtema(subtemaId, payload) {
    const { data } = await api.put(`/subtemas-curriculares/${subtemaId}`, payload)
    return data.subtema
  },

  async eliminarSubtema(subtemaId) {
    const { data } = await api.delete(`/subtemas-curriculares/${subtemaId}`)
    return data
  },
}

export default planCurricularService
