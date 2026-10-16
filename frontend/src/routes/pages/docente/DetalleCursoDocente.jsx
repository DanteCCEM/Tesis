import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import styles from './DetalleCursoDocente.module.css'

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
  if (nivel === 'SIN_EVALUACIONES') return styles.levelSinEval
  return styles.levelBasico
}

function getLevelLabel(est) {
  if (est.nivelActual === 'SIN_EVALUACIONES') return 'Sin evaluaciones'
  return est.nivelLabel ?? est.nivelActual ?? '—'
}

function getEstadoClass(estado) {
  if (estado === 'PUBLICADA') return styles.badgePublished
  if (estado === 'CERRADA') return styles.badgeClosed
  return styles.badgeDraft
}

function DetalleCursoDocente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cursoId = Number(id)

  const [curso, setCurso] = useState(null)
  const [estudiantes, setEstudiantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingEstudiantes, setLoadingEstudiantes] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    Promise.all([
      cursosService.detalle(cursoId),
      cursosService.resumenEstudiantes(cursoId),
    ])
      .then(([dataCurso, dataEstudiantes]) => {
        if (!cancelado) {
          setCurso(dataCurso)
          setEstudiantes(dataEstudiantes)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setCurso(null)
          setEstudiantes([])
          setError(err.mensaje || 'No se pudo cargar el curso.')
        }
      })
      .finally(() => {
        if (!cancelado) {
          setLoading(false)
          setLoadingEstudiantes(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [cursoId])

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Detalle del curso" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando curso…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Detalle del curso" />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>No se pudo acceder al curso</h2>
          <p className={styles.stateText}>{error}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/docente/cursos')}>
            Volver a mis cursos
          </Button>
        </div>
      </>
    )
  }

  if (!curso) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Detalle del curso" />
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Curso no encontrado</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/docente/cursos')}>
            Volver a mis cursos
          </Button>
        </div>
      </>
    )
  }

  const evaluaciones = curso.evaluaciones ?? []
  const rendimiento = curso.rendimiento ?? {}
  const cantidadEstudiantes = estudiantes.length

  return (
    <>
      <PageHeader
        eyebrow="Panel docente"
        title={curso.nombre}
        subtitle="Detalle del curso, alumnos y rendimiento del aula."
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/docente/cursos')}>
              ← Mis cursos
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/docente/cursos/${curso.id}/plan-curricular`)
              }
            >
              Plan curricular
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                navigate(`/docente/crear-evaluacion?cursoId=${curso.id}`)
              }
            >
              Crear evaluación
            </Button>
          </>
        }
      />

      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <span className={styles.gradeBadge}>
              {curso.grado} · Sección {curso.seccion} · {curso.anio}
            </span>
            <h1 className={styles.courseName}>{curso.nombre}</h1>
            <p className={styles.courseDesc}>
              {curso.descripcion || 'Sin descripción.'}
            </p>
            <p className={styles.teacher}>
              Docente: {curso.docente?.nombres ?? '—'}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{cantidadEstudiantes}</p>
          <p className={styles.statLabel}>Estudiantes matriculados</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{evaluaciones.length}</p>
          <p className={styles.statLabel}>Evaluaciones</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{rendimiento.promedioGeneral ?? 0}</p>
          <p className={styles.statLabel}>Promedio del curso (0–20)</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>
            {rendimiento.estudiantesBajoRendimiento?.length ?? 0}
          </p>
          <p className={styles.statLabel}>Alumnos con bajo rendimiento</p>
        </div>
      </div>

      <Card title="Estudiantes matriculados">
        {loadingEstudiantes ? (
          <div className={styles.stateInline}>
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.stateText}>Cargando estudiantes…</p>
          </div>
        ) : estudiantes.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Código / DNI</th>
                  <th>Evaluaciones</th>
                  <th>Promedio</th>
                  <th>Nivel</th>
                  <th>Última nota</th>
                  <th>Temas por reforzar</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {estudiantes.map((est) => (
                  <tr key={est.id}>
                    <td>
                      <div className={styles.studentCell}>
                        <span className={styles.avatar}>
                          {getInitials(est.nombres)}
                        </span>
                        <span>{est.nombres}</span>
                      </div>
                    </td>
                    <td>{est.codigoEstudiante || est.dni || '—'}</td>
                    <td>{est.cantidadEvaluacionesRealizadas}</td>
                    <td>
                      {est.promedioGeneral != null
                        ? `${est.promedioNota ?? Math.round(est.promedioGeneral / 5)}/20`
                        : 'Sin evaluaciones'}
                    </td>
                    <td>
                      <span
                        className={`${styles.levelBadge} ${getLevelClass(est.nivelActual)}`}
                      >
                        {getLevelLabel(est)}
                      </span>
                    </td>
                    <td>
                      {est.ultimaEvaluacion
                        ? `${est.ultimaEvaluacion.nota ?? Math.round(est.ultimaEvaluacion.porcentaje / 5)}/20`
                        : 'Sin evaluaciones'}
                    </td>
                    <td>
                      {est.temasPorReforzar?.length > 0 ? (
                        <div className={styles.topicTags}>
                          {est.temasPorReforzar.slice(0, 3).map((tema) => (
                            <span key={tema} className={styles.topicTag}>
                              {tema}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyText}>
            La sección todavía no tiene estudiantes matriculados para este año.
          </p>
        )}
      </Card>

      <div className={styles.columns}>
        <Card title="Evaluaciones del curso">
          {evaluaciones.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Estado</th>
                    <th>Preguntas</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluaciones.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <div>{ev.titulo}</div>
                        <div style={{ fontSize: '12.5px', color: 'var(--ev-text-muted)' }}>
                          {ev.tema}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${getEstadoClass(ev.estado)}`}
                        >
                          {ev.estadoLabel ?? ev.estado}
                        </span>
                      </td>
                      <td>{ev.totalPreguntas ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.emptyText}>
              Este curso aún no tiene evaluaciones.
            </p>
          )}
        </Card>
      </div>

      <Card title="Resumen de rendimiento del curso">
        {(rendimiento.intentosFinalizados ?? 0) === 0 ? (
          <p className={styles.emptyText}>
            Aún no hay evaluaciones finalizadas para calcular el rendimiento del
            aula.
          </p>
        ) : (
          <div className={styles.columns} style={{ marginBottom: 0 }}>
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>
                Estudiantes con bajo rendimiento (nota &lt; 11)
              </h3>
              {(rendimiento.estudiantesBajoRendimiento ?? []).length > 0 ? (
                <div className={styles.lowList}>
                  {rendimiento.estudiantesBajoRendimiento.map((est) => (
                    <div key={est.id} className={styles.lowItem}>
                      <span>{est.nombres}</span>
                      <strong>{est.promedioNota}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>
                  Ningún estudiante está por debajo del umbral de aprobación.
                </p>
              )}
            </div>
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>
                Temas con más errores
              </h3>
              {(rendimiento.temasConMasErrores ?? []).length > 0 ? (
                rendimiento.temasConMasErrores.map((tema) => (
                  <div key={tema.tema} className={styles.barItem}>
                    <div className={styles.barHead}>
                      <span>{tema.tema}</span>
                      <span>{tema.incorrectas} error(es)</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
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
            </div>
          </div>
        )}
      </Card>

    </>
  )
}

export default DetalleCursoDocente
