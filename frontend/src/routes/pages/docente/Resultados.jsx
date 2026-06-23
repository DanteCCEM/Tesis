import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import evaluacionesService from '../../../services/evaluacionesService.js'
import styles from './Resultados.module.css'

const NIVEL_LABEL = {
  BASICO: 'Básico',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
}

function getInitials(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

function getLevelClass(nivel) {
  if (nivel === 'AVANZADO') return styles.levelAvanzado
  if (nivel === 'INTERMEDIO') return styles.levelIntermedio
  return styles.levelBasico
}

function truncar(texto, max = 70) {
  if (!texto || texto.length <= max) return texto
  return `${texto.slice(0, max)}…`
}

function DocenteResultados() {
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [courseId, setCourseId] = useState('')
  const [evaluaciones, setEvaluaciones] = useState([])
  const [loadingEvals, setLoadingEvals] = useState(false)
  const [evalsError, setEvalsError] = useState('')
  const [evaluacionId, setEvaluacionId] = useState('')

  const [analitica, setAnalitica] = useState(null)
  const [loadingAnalitica, setLoadingAnalitica] = useState(false)
  const [analiticaError, setAnaliticaError] = useState('')

  const fetchCourses = () => {
    setLoading(true)
    cursosService
      .misCursos()
      .then((data) => {
        setCourses(data)
        setError('')
      })
      .catch((err) => setError(err.mensaje || 'No se pudieron cargar tus cursos.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelado = false
    cursosService
      .misCursos()
      .then((data) => {
        if (!cancelado) {
          setCourses(data)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err.mensaje || 'No se pudieron cargar tus cursos.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const handleCourseChange = (e) => {
    const value = e.target.value
    setCourseId(value)
    setEvaluaciones([])
    setEvaluacionId('')
    setEvalsError('')
    setAnalitica(null)
    setAnaliticaError('')
    setLoadingEvals(Boolean(value))
  }

  const handleEvaluacionChange = (e) => {
    const value = e.target.value
    setEvaluacionId(value)
    setAnalitica(null)
    setAnaliticaError('')
    setLoadingAnalitica(Boolean(value))
  }

  useEffect(() => {
    if (!courseId) return undefined
    let cancelado = false
    evaluacionesService
      .listarPorCurso(Number(courseId))
      .then((data) => {
        if (!cancelado) {
          setEvaluaciones(data)
          setEvaluacionId(data[0]?.id ? String(data[0].id) : '')
          setLoadingAnalitica(Boolean(data[0]?.id))
        }
      })
      .catch((err) => {
        if (!cancelado) setEvalsError(err.mensaje || 'No se pudieron cargar las evaluaciones.')
      })
      .finally(() => {
        if (!cancelado) setLoadingEvals(false)
      })
    return () => {
      cancelado = true
    }
  }, [courseId])

  useEffect(() => {
    if (!evaluacionId) return undefined
    let cancelado = false
    evaluacionesService
      .analitica(Number(evaluacionId))
      .then((data) => {
        if (!cancelado) {
          setAnalitica(data)
          setAnaliticaError('')
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setAnaliticaError(err.mensaje || 'No se pudo cargar la analítica.')
        }
      })
      .finally(() => {
        if (!cancelado) setLoadingAnalitica(false)
      })
    return () => {
      cancelado = true
    }
  }, [evaluacionId])

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Resultados" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Resultados" />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCourses}>
            Reintentar
          </Button>
        </div>
      </>
    )
  }

  if (courses.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Panel docente"
          title="Resultados"
          subtitle="Analiza el desempeño de tus evaluaciones."
        />
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Aún no tienes cursos</h2>
          <p className={styles.stateText}>
            Crea un curso y publica evaluaciones para ver resultados aquí.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/docente/cursos')}>
            Ir a mis cursos
          </Button>
        </div>
      </>
    )
  }

  const resumen = analitica?.resumen
  const porcentajeAprobacion = resumen?.porcentajeAprobacion ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Panel docente"
        title="Resultados"
        subtitle="Analiza el desempeño del aula por curso y evaluación."
      />

      <Card title="Selecciona qué analizar">
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="course">
              Curso
            </label>
            <select
              id="course"
              className={styles.select}
              value={courseId}
              onChange={handleCourseChange}
            >
              <option value="">Selecciona un curso…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="evaluation">
              Evaluación
            </label>
            <select
              id="evaluation"
              className={styles.select}
              value={evaluacionId}
              onChange={handleEvaluacionChange}
              disabled={!courseId || evaluaciones.length === 0}
            >
              {evaluaciones.length === 0 ? (
                <option value="">Sin evaluaciones</option>
              ) : (
                evaluaciones.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.titulo}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </Card>

      {!courseId ? (
        <div className={styles.state} style={{ marginTop: '22px' }}>
          <h2 className={styles.stateTitle}>Selecciona un curso</h2>
          <p className={styles.stateText}>
            Elige un curso y una evaluación para ver su analítica.
          </p>
        </div>
      ) : loadingEvals ? (
        <div className={styles.state} style={{ marginTop: '22px' }}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando evaluaciones…</p>
        </div>
      ) : evalsError ? (
        <div
          className={`${styles.state} ${styles.stateError}`}
          style={{ marginTop: '22px' }}
          role="alert"
        >
          <p className={styles.stateText}>{evalsError}</p>
        </div>
      ) : evaluaciones.length === 0 ? (
        <div className={styles.state} style={{ marginTop: '22px' }}>
          <h2 className={styles.stateTitle}>Este curso no tiene evaluaciones</h2>
          <p className={styles.stateText}>
            Crea una evaluación para empezar a recopilar resultados.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/docente/crear-evaluacion')}
          >
            Crear evaluación
          </Button>
        </div>
      ) : loadingAnalitica ? (
        <div className={styles.state} style={{ marginTop: '22px' }}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando analítica…</p>
        </div>
      ) : analiticaError ? (
        <div
          className={`${styles.state} ${styles.stateError}`}
          style={{ marginTop: '22px' }}
          role="alert"
        >
          <p className={styles.stateText}>{analiticaError}</p>
        </div>
      ) : resumen?.intentosFinalizados === 0 ? (
        <div className={styles.state} style={{ marginTop: '22px' }}>
          <h2 className={styles.stateTitle}>Aún no hay intentos finalizados</h2>
          <p className={styles.stateText}>
            Cuando los estudiantes completen esta evaluación verás promedios,
            preguntas con más errores y desempeño individual.
          </p>
          {resumen?.estudiantesMatriculados > 0 && (
            <p className={styles.stateText}>
              {resumen.estudiantesMatriculados} estudiante(s) matriculado(s) ·{' '}
              {resumen.pendientes} pendiente(s) de completar.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className={styles.overview}>
            <div className={styles.donutCard}>
              <div
                className={styles.donut}
                style={{
                  background: `conic-gradient(#16a34a 0% ${porcentajeAprobacion}%, #dc2626 ${porcentajeAprobacion}% 100%)`,
                }}
              >
                <div className={styles.donutHole}>
                  <span className={styles.donutValue}>{porcentajeAprobacion}%</span>
                  <span className={styles.donutLabel}>Aprobación</span>
                </div>
              </div>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#16a34a' }} />
                  Aprobados ({resumen?.aprobados ?? 0})
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#dc2626' }} />
                  Reprobados ({resumen?.reprobados ?? 0})
                </span>
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{resumen?.promedioNota ?? 0}</span>
                <span className={styles.statLabel}>Promedio del aula (0–20)</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{resumen?.intentosFinalizados ?? 0}</span>
                <span className={styles.statLabel}>Intentos finalizados</span>
              </div>
              <div className={styles.statCard}>
                <span className={`${styles.statValue} ${styles.statApproved}`}>
                  {resumen?.aprobados ?? 0}
                </span>
                <span className={styles.statLabel}>Estudiantes aprobados</span>
              </div>
              <div className={styles.statCard}>
                <span className={`${styles.statValue} ${styles.statFailed}`}>
                  {resumen?.reprobados ?? 0}
                </span>
                <span className={styles.statLabel}>Estudiantes reprobados</span>
              </div>
              {(resumen?.estudiantesPorReforzar ?? 0) > 0 && (
                <div className={styles.reinforceCard}>
                  <span className={styles.reinforceIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 9v4M12 17h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h18a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className={styles.reinforceValue}>
                      {resumen.estudiantesPorReforzar} estudiante(s)
                    </p>
                    <p className={styles.reinforceText}>
                      necesitan refuerzo en esta evaluación (nota &lt; 11).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.columns}>
            <Card title="Preguntas con más errores">
              {(analitica?.preguntasConMasErrores ?? []).length > 0 ? (
                analitica.preguntasConMasErrores.map((pregunta) => (
                  <div key={pregunta.id} className={styles.barItem}>
                    <div className={styles.barHead}>
                      <span title={pregunta.enunciado}>
                        {truncar(pregunta.enunciado)}
                      </span>
                      <span>{pregunta.porcentajeError}%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${pregunta.porcentajeError}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.emptyText}>
                  No hay preguntas con errores registrados.
                </p>
              )}
            </Card>

            <Card title="Temas con más dificultad">
              {(analitica?.temasConMasErrores ?? []).length > 0 ? (
                analitica.temasConMasErrores.map((tema) => (
                  <div key={tema.tema} className={styles.barItem}>
                    <div className={styles.barHead}>
                      <span>{tema.tema}</span>
                      <span>{tema.porcentajeError}%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={`${styles.barFill} ${styles.barFillTopic}`}
                        style={{ width: `${tema.porcentajeError}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.emptyText}>
                  No hay temas con errores registrados.
                </p>
              )}
            </Card>
          </div>

          <Card
            title="Desempeño por estudiante"
            subtitle={`${analitica?.evaluacion?.titulo ?? ''} · ${analitica?.evaluacion?.curso?.nombre ?? ''}`}
          >
            {(analitica?.estudiantes ?? []).length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Nota</th>
                      <th>Nivel</th>
                      <th>Recomendación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analitica.estudiantes.map((est) => (
                      <tr key={est.intentoId}>
                        <td>
                          <div className={styles.studentCell}>
                            <span className={styles.avatar}>{getInitials(est.nombres)}</span>
                            {est.nombres}
                          </div>
                        </td>
                        <td className={styles.scoreCell}>{est.nota}</td>
                        <td>
                          <span
                            className={`${styles.levelBadge} ${getLevelClass(est.nivelObtenido)}`}
                          >
                            {NIVEL_LABEL[est.nivelObtenido] ?? '—'}
                          </span>
                        </td>
                        <td className={styles.recommendation}>{est.recomendacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.emptyText}>No hay estudiantes para mostrar.</p>
            )}
          </Card>
        </>
      )}
    </>
  )
}

export default DocenteResultados
