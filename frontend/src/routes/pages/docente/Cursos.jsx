import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import styles from './Cursos.module.css'

const EMPTY_FORM = { name: '', grade: '', section: '', description: '' }

function DocenteCursos() {
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [enrollCourse, setEnrollCourse] = useState(null)
  const [enrollEmail, setEnrollEmail] = useState('')
  const [enrollError, setEnrollError] = useState('')
  const [enrollSuccess, setEnrollSuccess] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  const fetchCourses = useCallback(async () => {
    try {
      const data = await cursosService.misCursos()
      setCourses(data)
      setLoadError('')
      return data
    } catch (error) {
      setLoadError(error.mensaje || 'No se pudieron cargar los cursos.')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const retryCourses = () => {
    setLoading(true)
    fetchCourses()
  }

  useEffect(() => {
    let cancelado = false
    cursosService
      .misCursos()
      .then((data) => {
        if (!cancelado) {
          setCourses(data)
          setLoadError('')
        }
      })
      .catch((error) => {
        if (!cancelado) {
          setLoadError(error.mensaje || 'No se pudieron cargar los cursos.')
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const openModal = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (submitting) return
    setIsModalOpen(false)
  }

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'El nombre del curso es obligatorio.'
    if (!form.grade.trim()) nextErrors.grade = 'El grado es obligatorio.'
    if (!form.section.trim()) nextErrors.section = 'La sección es obligatoria.'
    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      await cursosService.crear({
        nombre: form.name.trim(),
        grado: form.grade.trim(),
        seccion: form.section.trim(),
        descripcion: form.description.trim() || undefined,
      })
      setIsModalOpen(false)
      await fetchCourses()
    } catch (error) {
      setErrors({ form: error.mensaje || 'No se pudo crear el curso.' })
    } finally {
      setSubmitting(false)
    }
  }

  const openEnroll = (course) => {
    setEnrollCourse(course)
    setEnrollEmail('')
    setEnrollError('')
    setEnrollSuccess('')
  }

  const closeEnroll = () => {
    if (enrolling) return
    setEnrollCourse(null)
  }

  const handleEnroll = async (event) => {
    event.preventDefault()
    if (!enrollEmail.trim()) {
      setEnrollError('Ingresa el correo del estudiante.')
      return
    }

    setEnrolling(true)
    setEnrollError('')
    setEnrollSuccess('')
    try {
      await cursosService.matricular(enrollCourse.id, {
        correo: enrollEmail.trim(),
      })
      setEnrollSuccess('Estudiante matriculado correctamente.')
      setEnrollEmail('')
      const data = await fetchCourses()
      const updated = data.find((c) => c.id === enrollCourse.id)
      if (updated) setEnrollCourse(updated)
    } catch (error) {
      setEnrollError(error.mensaje || 'No se pudo matricular al estudiante.')
    } finally {
      setEnrolling(false)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando tus cursos…</p>
        </div>
      )
    }

    if (loadError) {
      return (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{loadError}</p>
          <Button variant="outline" size="sm" onClick={retryCourses}>
            Reintentar
          </Button>
        </div>
      )
    }

    if (courses.length === 0) {
      return (
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Aún no tienes cursos</h2>
          <p className={styles.stateText}>
            Crea tu primer curso para empezar a gestionar evaluaciones.
          </p>
          <Button variant="primary" size="sm" onClick={openModal}>
            Crear curso
          </Button>
        </div>
      )
    }

    return (
      <div className={styles.grid}>
        {courses.map((course) => (
          <article key={course.id} className={styles.courseCard}>
            <div className={styles.banner} />
            <div className={styles.courseBody}>
              <span className={styles.gradeBadge}>
                {course.grado} · Sección {course.seccion}
              </span>
              <h2 className={styles.courseName}>{course.nombre}</h2>
              <p className={styles.courseDesc}>
                {course.descripcion || 'Sin descripción.'}
              </p>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>
                    {course._count?.matriculas ?? 0}
                  </span>
                  <span className={styles.metricLabel}>Estudiantes</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>
                    {course._count?.evaluaciones ?? 0}
                  </span>
                  <span className={styles.metricLabel}>Evaluaciones</span>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/docente/cursos/${course.id}`)}
              >
                Ver detalle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEnroll(course)}
              >
                Matricular
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  navigate(`/docente/crear-evaluacion?cursoId=${course.id}`)
                }
              >
                Crear evaluación
              </Button>
            </div>
          </article>
        ))}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Panel docente"
        title="Mis cursos"
        subtitle="Administra tus cursos y crea evaluaciones para cada uno."
        actions={
          <Button variant="primary" onClick={openModal}>
            Crear curso
          </Button>
        }
      />

      {renderContent()}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Crear nuevo curso"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="course-form"
              disabled={submitting}
            >
              {submitting ? 'Creando…' : 'Crear curso'}
            </Button>
          </>
        }
      >
        <form
          id="course-form"
          className={styles.form}
          onSubmit={handleSubmit}
          noValidate
        >
          {errors.form && <div className={styles.formError}>{errors.form}</div>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Nombre del curso
            </label>
            <input
              id="name"
              type="text"
              className={`${styles.input} ${
                errors.name ? styles.inputError : ''
              }`}
              placeholder="Ej. Matemáticas III"
              value={form.name}
              onChange={handleChange('name')}
            />
            {errors.name && (
              <span className={styles.errorText}>{errors.name}</span>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="grade">
                Grado
              </label>
              <input
                id="grade"
                type="text"
                className={`${styles.input} ${
                  errors.grade ? styles.inputError : ''
                }`}
                placeholder="Ej. 3.º Bachillerato"
                value={form.grade}
                onChange={handleChange('grade')}
              />
              {errors.grade && (
                <span className={styles.errorText}>{errors.grade}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="section">
                Sección
              </label>
              <input
                id="section"
                type="text"
                className={`${styles.input} ${
                  errors.section ? styles.inputError : ''
                }`}
                placeholder="Ej. A"
                value={form.section}
                onChange={handleChange('section')}
              />
              {errors.section && (
                <span className={styles.errorText}>{errors.section}</span>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="description">
              Descripción
            </label>
            <textarea
              id="description"
              className={styles.textarea}
              placeholder="Breve descripción del curso (opcional)"
              value={form.description}
              onChange={handleChange('description')}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(enrollCourse)}
        onClose={closeEnroll}
        title={
          enrollCourse ? `Matricular en ${enrollCourse.nombre}` : 'Matricular'
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeEnroll} disabled={enrolling}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="enroll-form"
              disabled={enrolling}
            >
              {enrolling ? 'Matriculando…' : 'Matricular'}
            </Button>
          </>
        }
      >
        <form
          id="enroll-form"
          className={styles.form}
          onSubmit={handleEnroll}
          noValidate
        >
          {enrollError && <div className={styles.formError}>{enrollError}</div>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="enrollEmail">
              Correo del estudiante
            </label>
            <input
              id="enrollEmail"
              type="email"
              className={`${styles.input} ${
                enrollError ? styles.inputError : ''
              }`}
              placeholder="estudiante@correo.com"
              value={enrollEmail}
              onChange={(event) => {
                setEnrollEmail(event.target.value)
                setEnrollError('')
              }}
            />
            <span className={styles.fieldHint}>
              El estudiante debe tener una cuenta registrada.
            </span>
          </div>

          {enrollSuccess && (
            <div className={styles.feedback} role="status">
              {enrollSuccess}
            </div>
          )}
        </form>
      </Modal>
    </>
  )
}

export default DocenteCursos
