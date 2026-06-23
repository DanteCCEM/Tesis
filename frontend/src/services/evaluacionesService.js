import api from './api.js'

const evaluacionesService = {
  // GET /api/evaluaciones/curso/:cursoId -> { ok, evaluaciones }
  async listarPorCurso(cursoId) {
    const { data } = await api.get(`/evaluaciones/curso/${cursoId}`)
    return data.evaluaciones
  },

  // GET /api/evaluaciones/:id -> { ok, evaluacion }
  async obtener(evaluacionId) {
    const { data } = await api.get(`/evaluaciones/${evaluacionId}`)
    return data.evaluacion
  },

  // POST /api/evaluaciones -> { ok, evaluacion } (solo DOCENTE)
  async crear(payload) {
    const { data } = await api.post('/evaluaciones', payload)
    return data.evaluacion
  },

  // POST /api/evaluaciones/:id/preguntas -> { ok, pregunta }
  async agregarPregunta(evaluacionId, payload) {
    const { data } = await api.post(
      `/evaluaciones/${evaluacionId}/preguntas`,
      payload,
    )
    return data.pregunta
  },

  // PUT /api/evaluaciones/:id/publicar -> { ok, evaluacion }
  async publicar(evaluacionId) {
    const { data } = await api.put(`/evaluaciones/${evaluacionId}/publicar`)
    return data.evaluacion
  },

  // GET /api/evaluaciones/:id/analitica -> { ok, analitica } (solo DOCENTE)
  async analitica(evaluacionId) {
    const { data } = await api.get(`/evaluaciones/${evaluacionId}/analitica`)
    return data.analitica
  },

  // POST /api/evaluaciones/:id/iniciar -> { ok, intento, evaluacion, respuestasGuardadas }
  async iniciar(evaluacionId) {
    const { data } = await api.post(`/evaluaciones/${evaluacionId}/iniciar`)
    return data
  },
}

export default evaluacionesService
