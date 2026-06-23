import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Modal, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import perfilService from '../../../services/perfilService.js'
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

function formatFecha(valor) {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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

  const [profileTarget, setProfileTarget] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollEmail, setEnrollEmail] = useState('')
  const [enrollError, setEnrollError] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const [removing, setRemoving] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')

  const fetchCurso = useCallback(async () => {
    if (!Number.isInteger(cursoId) || cursoId <= 0) {
      setError('Identificador de curso inválido.')
      setLoading(false)
      setLoadingEstudiantes(false)
      return
    }
    setLoadingEstudiantes(true)
    try {
      const [dataCurso, dataEstudiantes] = await Promise.all([
        cursosService.detalle(cursoId),
        cursosService.resumenEstudiantes(cursoId),
      ])
      setCurso(dataCurso)
      setEstudiantes(dataEstudiantes)
      setError('')
    } catch (err) {
      setCurso(null)
      setEstudiantes([])
      setError(err.mensaje || 'No se pudo cargar el curso.')
    } finally {
      setLoading(false)
      setLoadingEstudiantes(false)
    }
  }, [cursoId])

  const openProfile = async (estudiante) => {
    setProfileTarget(estudiante)
    setProfileData(null)
    setProfileError('')
    setProfileLoading(true)
    try {
      const data = await perfilService.obtenerPerfilUsuario(estudiante.id)
      setProfileData(data.perfil)
    } catch (err) {
      setProfileError(err.mensaje || 'No se pudo cargar el perfil del estudiante.')
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setLoadingEstudiantes(true)
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

  const handleEnroll = async (event) => {
    event.preventDefault()
    if (!enrollEmail.trim()) {
      setEnrollError('Ingresa el correo del estudiante.')
      return
    }
    setEnrolling(true)
    setEnrollError('')
    setActionSuccess('')
    try {
      await cursosService.matricular(cursoId, { correo: enrollEmail.trim() })
      setEnrollEmail('')
      setEnrollOpen(false)
      setActionSuccess('Estudiante matriculado correctamente.')
      await fetchCurso()
    } catch (err) {
      setEnrollError(err.mensaje || 'No se pudo matricular al estudiante.')
    } finally {
      setEnrolling(false)
    }
  }

  const executeRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveError('')
    setActionSuccess('')
    try {
      const resultado = await cursosService.eliminarMatricula(
        cursoId,
        removeTarget.id,
      )
      setEstudiantes(resultado.estudiantes ?? [])
      setCurso((prev) =>
        prev
          ? {
              ...prev,
              cantidadEstudiantes: resultado.estudiantes?.length ?? 0,
            }
          : prev,
      )
      setActionSuccess(resultado.mensaje || 'Estudiante eliminado del curso.')
      setRemoveTarget(null)
      await fetchCurso()
    } catch (err) {
      setRemoveError(err.mensaje || 'No se pudo eliminar al estudiante.')
    } finally {
      setRemoving(false)
    }
  }

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

      {actionSuccess && (
        <div className={styles.feedback} role="status" style={{ marginBottom: '16px' }}>
          {actionSuccess}
        </div>
      )}

      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <span className={styles.gradeBadge}>
              {curso.grado} · Sección {curso.seccion}
            </span>
            <h1 className={styles.courseName}>{curso.nombre}</h1>
            <p className={styles.courseDesc}>
              {curso.descripcion || 'Sin descripción.'}
            </p>
            <p className={styles.teacher}>
              Docente: {curso.docente?.nombres ?? '—'} ·{' '}
              {curso.docente?.correo ?? ''}
            </p>
          </div>
          <Button variant="outline" onClick={() => setEnrollOpen(true)}>
            Matricular alumno
          </Button>
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
                  <th>Correo</th>
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
                    <td>{est.correo}</td>
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
                    <td>
                      <div className={styles.rowActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openProfile(est)}
                        >
                          Ver perfil
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRemoveTarget(est)
                            setRemoveError('')
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyText}>
            Aún no hay estudiantes matriculados en este curso.
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

      <Modal
        isOpen={enrollOpen}
        onClose={() => !enrolling && setEnrollOpen(false)}
        title={`Matricular en ${curso.nombre}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnrollOpen(false)} disabled={enrolling}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="enroll-form" disabled={enrolling}>
              {enrolling ? 'Matriculando…' : 'Matricular'}
            </Button>
          </>
        }
      >
        <form id="enroll-form" className={styles.form} onSubmit={handleEnroll}>
          {enrollError && <div className={styles.formError}>{enrollError}</div>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="enrollEmail">
              Correo del estudiante
            </label>
            <input
              id="enrollEmail"
              type="email"
              className={styles.input}
              placeholder="estudiante@correo.com"
              value={enrollEmail}
              onChange={(e) => {
                setEnrollEmail(e.target.value)
                setEnrollError('')
              }}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(profileTarget)}
        onClose={() => !profileLoading && setProfileTarget(null)}
        title={profileTarget ? `Perfil de ${profileTarget.nombres}` : 'Perfil'}
        footer={
          <Button variant="ghost" onClick={() => setProfileTarget(null)}>
            Cerrar
          </Button>
        }
      >
        {profileLoading ? (
          <div className={styles.stateInline}>
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.stateText}>Cargando perfil…</p>
          </div>
        ) : profileError ? (
          <p className={styles.formError}>{profileError}</p>
        ) : profileData ? (
          <div className={styles.profileBody}>
            <p>
              <strong>Nombre:</strong> {profileData.nombres}
            </p>
            <p>
              <strong>Correo:</strong> {profileData.correo}
            </p>
            {profileData.institucionEducativa && (
              <p>
                <strong>Institución:</strong> {profileData.institucionEducativa}
              </p>
            )}
            {profileData.telefono && (
              <p>
                <strong>Teléfono:</strong> {profileData.telefono}
              </p>
            )}
            {profileData.biografiaCorta && (
              <p>
                <strong>Biografía:</strong> {profileData.biografiaCorta}
              </p>
            )}
            {profileTarget?.ultimaEvaluacion && (
              <p>
                <strong>Última evaluación en este curso:</strong>{' '}
                {profileTarget.ultimaEvaluacion.titulo} (
                {formatFecha(profileTarget.ultimaEvaluacion.fechaFin)})
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(removeTarget)}
        onClose={() => !removing && setRemoveTarget(null)}
        title="Confirmar eliminación"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={executeRemove} disabled={removing}>
              {removing ? 'Eliminando…' : 'Sí, eliminar del curso'}
            </Button>
          </>
        }
      >
        {removeTarget && (
          <>
            <p className={styles.confirmText}>
              ¿Eliminar a <strong>{removeTarget.nombres}</strong> de este curso?
            </p>
            <p className={styles.confirmHint}>
              Se quitará la matrícula, pero se conservarán sus resultados
              históricos.
            </p>
            {removeError && (
              <div className={styles.formError} style={{ marginTop: '14px' }}>
                {removeError}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  )
}

export default DetalleCursoDocente
