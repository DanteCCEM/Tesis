import api from './api.js'

const adminService = {
  async listarUsuarios(tipo, { page = 1, pageSize = 10, q = '' } = {}) {
    const { data } = await api.get(`/admin/${tipo}`, { params: { page, pageSize, q } })
    return data
  },

  async crearUsuario(tipo, datos) {
    const { data } = await api.post(`/admin/${tipo}`, datos)
    return data
  },

  async actualizarUsuario(tipo, usuarioId, datos) {
    const { data } = await api.put(`/admin/${tipo}/${usuarioId}`, datos)
    return data.usuario
  },

  async restablecerPassword(usuarioId) {
    const { data } = await api.post(`/admin/usuarios/${usuarioId}/restablecer-password`)
    return data
  },

  async cambiarEstado(usuarioId, estado) {
    const { data } = await api.patch(`/admin/usuarios/${usuarioId}/estado`, { estado })
    return data.usuario
  },

  async obtenerAsignaciones(docenteId) {
    const { data } = await api.get(`/admin/docentes/${docenteId}/asignaciones`)
    return data.asignaciones
  },

  async cambiarMatricula(estudianteId, datos) {
    const { data } = await api.put(
      `/admin/estudiantes/${estudianteId}/matricula-academica`,
      datos,
    )
    return data.matricula
  },

  async obtenerRendimiento(estudianteId) {
    const { data } = await api.get(`/admin/estudiantes/${estudianteId}/rendimiento`)
    return data.rendimiento
  },

  async listarAnios() {
    const { data } = await api.get('/admin/anios-academicos')
    return data.anios
  },

  async listarSecciones() {
    const { data } = await api.get('/admin/secciones')
    return data.secciones
  },

  async listarAreas() {
    const { data } = await api.get('/admin/areas-curriculares')
    return data.areas
  },

  async listarAsignaciones() {
    const { data } = await api.get('/admin/asignaciones')
    return data.asignaciones
  },

  async guardarAsignacion(datos, id = null) {
    const { data } = id
      ? await api.put(`/admin/asignaciones/${id}`, datos)
      : await api.post('/admin/asignaciones', datos)
    return data.asignacion
  },

  async descargarPlantillaEstudiantes() {
    const response = await api.get('/admin/estudiantes-importacion/plantilla', {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'plantilla-estudiantes.xlsx'
    enlace.click()
    URL.revokeObjectURL(url)
  },

  async importarEstudiantes(archivo, anioAcademicoId, seccionId) {
    const form = new FormData()
    form.append('archivo', archivo)
    form.append('anioAcademicoId', anioAcademicoId)
    form.append('seccionId', seccionId)
    const { data } = await api.post('/admin/estudiantes-importacion', form)
    return data
  },
}

export default adminService
