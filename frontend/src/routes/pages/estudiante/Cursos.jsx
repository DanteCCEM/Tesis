import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import evaluacionesService from '../../../services/evaluacionesService.js'
import styles from './Cursos.module.css'

function EvaluacionActions({ evaluacion, onConflict }) {
  const navigate = useNavigate()
  const miIntento = evaluacion.miIntento

  const irEvaluacion = async () => {
    try {
      navigate('/estudiante/evaluacion', {
        state: { evaluacionId: evaluacion.id },
      })
    } catch (err) {
      onConflict?.(err.mensaje)
    }
  }

  if (miIntento?.estado === 'FINALIZADO') {
    return (
      <div className={styles.evalActions}>
        <span className={styles.statusCompleted}>Completada</span>
        <Button variant="primary" size="sm" disabled>
          Resolver evaluación
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            navigate('/estudiante/resultados', {
              state: { intentoId: miIntento.id },
            })
          }
        >
          Ver resultados
        </Button>
      </div>
    )
  }

  if (miIntento?.estado === 'EN_PROGRESO') {
    return (
      <div className={styles.evalActions}>
        <Button variant="primary" size="sm" onClick={irEvaluacion}>
          Continuar evaluación
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.evalActions}>
      <Button variant="primary" size="sm" onClick={irEvaluacion}>
        Resolver evaluación
      </Button>
    </div>
  )
}

function EstudianteCursos() {
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selected, setSelected] = useState(null)
  const [evaluaciones, setEvaluaciones] = useState([])
  const [loadingEvals, setLoadingEvals] = useState(false)
  const [evalsError, setEvalsError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const fetchCourses = useCallback(async () => {
    try {
      const data = await cursosService.misCursos()
      setCourses(data)
      setLoadError('')
    } catch (err) {
      setLoadError(err.mensaje || 'No se pudieron cargar tus cursos.')
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
      .catch((err) => {
        if (!cancelado) {
          setLoadError(err.mensaje || 'No se pudieron cargar tus cursos.')
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const openCourse = useCallback(async (course) => {
    setSelected(course)
    setLoadingEvals(true)
    setEvalsError('')
    setActionMessage('')
    try {
      const data = await evaluacionesService.listarPorCurso(course.id)
      setEvaluaciones(data)
    } catch (err) {
      setEvalsError(err.mensaje || 'No se pudieron cargar las evaluaciones.')
    } finally {
      setLoadingEvals(false)
    }
  }, [])

  const backToList = () => {
    setSelected(null)
    setEvaluaciones([])
    setEvalsError('')
    setActionMessage('')
  }

  if (selected) {
    return (
      <>
        <PageHeader
          eyebrow="Mis cursos"
          title={selected.nombre}
          subtitle={selected.docente?.nombres ?? 'Docente'}
          actions={
            <>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/estudiante/cursos/${selected.id}/temas`)
                }
              >
                Ver temas del curso
              </Button>
              <Button variant="ghost" onClick={backToList}>
                ← Volver a mis cursos
              </Button>
            </>
          }
        />

        {actionMessage && (
          <div className={styles.actionNotice} role="alert">
            {actionMessage}
          </div>
        )}

        <Card
          title="Evaluaciones disponibles"
          subtitle="Evaluaciones publicadas en este curso"
        >
          {loadingEvals ? (
            <div className={styles.state}>
              <span className={styles.spinner} aria-hidden="true" />
              <p className={styles.stateText}>Cargando evaluaciones…</p>
            </div>
          ) : evalsError ? (
            <div className={`${styles.state} ${styles.stateError}`} role="alert">
              <h2 className={styles.stateTitle}>Ocurrió un error</h2>
              <p className={styles.stateText}>{evalsError}</p>
              <Button variant="outline" size="sm" onClick={() => openCourse(selected)}>
                Reintentar
              </Button>
            </div>
          ) : evaluaciones.length > 0 ? (
            evaluaciones
              .filter((ev) => !ev.esPracticaAdaptativa)
              .map((evaluacion) => (
                <div key={evaluacion.id} className={styles.evalRow}>
                  <span
                    className={`${styles.evalIcon} ${
                      evaluacion.miIntento?.estado === 'FINALIZADO'
                        ? styles.evalIconDone
                        : styles.evalIconAvailable
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </span>
                  <div className={styles.evalInfo}>
                    <p className={styles.evalName}>{evaluacion.titulo}</p>
                    <p className={styles.evalMeta}>
                      {evaluacion.tema} · {evaluacion._count?.preguntas ?? 0} preguntas
                    </p>
                  </div>
                  <EvaluacionActions
                    evaluacion={evaluacion}
                    onConflict={setActionMessage}
                  />
                </div>
              ))
          ) : (
            <p className={styles.empty}>
              No tienes evaluaciones disponibles en este curso por ahora.
            </p>
          )}
        </Card>

        <div className={styles.divider} />

        <Card title="Tu historial" subtitle="Consulta tus notas y tu evolución">
          <p className={styles.empty}>
            Revisa el detalle de tus resultados y recomendaciones en la sección
            de progreso.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/estudiante/progreso')}>
            Ver mi progreso
          </Button>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Panel estudiante"
        title="Mis cursos"
        subtitle="Consulta tus cursos y las evaluaciones de cada uno."
      />

      {loading ? (
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando tus cursos…</p>
        </div>
      ) : loadError ? (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{loadError}</p>
          <Button variant="outline" size="sm" onClick={retryCourses}>
            Reintentar
          </Button>
        </div>
      ) : courses.length === 0 ? (
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Aún no estás matriculado en cursos</h2>
          <p className={styles.stateText}>
            Cuando un docente te matricule, tus cursos aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {courses.map((course) => (
            <article key={course.id} className={styles.courseCard}>
              <div className={styles.banner} />
              <div className={styles.courseBody}>
                <h2 className={styles.courseName}>{course.nombre}</h2>
                <p className={styles.teacher}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
                  </svg>
                  {course.docente?.nombres ?? 'Docente'}
                </p>

                <span className={styles.pending}>
                  <span className={styles.pendingDot} />
                  {course._count?.evaluaciones ?? 0} evaluación(es) ·{' '}
                  {course.grado} {course.seccion}
                </span>
              </div>

              <div className={styles.actions}>
                <Button variant="primary" fullWidth onClick={() => openCourse(course)}>
                  Ver curso
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() =>
                    navigate(`/estudiante/cursos/${course.id}/temas`)
                  }
                >
                  Ver temas del curso
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

export default EstudianteCursos
