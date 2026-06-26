import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import planCurricularService from '../../../services/planCurricularService.js'
import progresoService from '../../../services/progresoService.js'
import styles from './TemasDelCurso.module.css'

const PERIODOS = {
  SEMESTRE: 'Semestre',
  TRIMESTRE: 'Trimestre',
  BIMESTRE: 'Bimestre',
}

const ESTADOS_ESTUDIANTE = {
  PENDIENTE: { label: 'Pendiente', badgeClass: styles.badgePending },
  EN_PROCESO: { label: 'En proceso', badgeClass: styles.badgeProgress },
  COMPLETADO: { label: 'Completado', badgeClass: styles.badgeDone },
}

const UMBRAL_DOMINIO = 80

const normalizarTema = (valor) => String(valor ?? '').trim().toLowerCase()

function obtenerStatsTema(tema, porTema = []) {
  const porId = porTema.find(
    (item) => item.temaCurricularId != null && item.temaCurricularId === tema.id,
  )
  if (porId) return porId

  const titulo = normalizarTema(tema.titulo)
  return porTema.find((item) => normalizarTema(item.tema) === titulo)
}

function enriquecerPlan(plan, porTema = []) {
  const unidades = (plan?.unidades ?? []).map((unidad) => ({
    ...unidad,
    temas: (unidad.temas ?? []).map((tema) => {
      const stats = obtenerStatsTema(tema, porTema)
      return {
        ...tema,
        estadoEstudiante: stats?.estadoEstudiante ?? 'PENDIENTE',
        porcentajeDominio: stats?.porcentajeDominio ?? null,
        promedioEvaluaciones: stats?.promedioEvaluaciones ?? null,
        evaluacionesFinalizadas: stats?.evaluacionesFinalizadas ?? 0,
      }
    }),
  }))

  return { ...plan, unidades }
}

function flattenTemas(unidades = []) {
  return unidades.flatMap((unidad) =>
    (unidad.temas ?? []).map((tema) => ({
      ...tema,
      unidadTitulo: unidad.titulo,
    })),
  )
}

function calcularProgresoGeneral(temas = []) {
  if (temas.length === 0) {
    return { porcentaje: 0, completados: 0, total: 0 }
  }

  const completados = temas.filter(
    (tema) => tema.estadoEstudiante === 'COMPLETADO',
  ).length

  return {
    porcentaje: Math.round((completados / temas.length) * 100),
    completados,
    total: temas.length,
  }
}

function EstadoBadge({ estado }) {
  const config = ESTADOS_ESTUDIANTE[estado] ?? ESTADOS_ESTUDIANTE.PENDIENTE
  return (
    <span className={`${styles.badge} ${config.badgeClass}`}>{config.label}</span>
  )
}

function TemasDelCurso() {
  const navigate = useNavigate()
  const { cursoId } = useParams()

  const [curso, setCurso] = useState(null)
  const [plan, setPlan] = useState(null)
  const [progreso, setProgreso] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openUnits, setOpenUnits] = useState(() => new Set())

  useEffect(() => {
    let cancelado = false

    const cargar = async () => {
      setLoading(true)
      setError('')

      try {
        const [cursos, planes, progresoCurso] = await Promise.all([
          cursosService.misCursos(),
          planCurricularService.listarPorCurso(Number(cursoId)),
          progresoService.miProgreso(Number(cursoId)),
        ])

        if (cancelado) return

        const cursoEncontrado = cursos.find(
          (item) => String(item.id) === String(cursoId),
        )

        if (!cursoEncontrado) {
          setError('No tienes acceso a este curso o no estás matriculado.')
          setCurso(null)
          setPlan(null)
          setProgreso(null)
          return
        }

        const planPublicado = planes.find((item) => item.estado === 'PUBLICADO') ?? null

        setCurso(cursoEncontrado)
        setPlan(planPublicado)
        setProgreso(progresoCurso)

        if (planPublicado?.unidades?.length) {
          setOpenUnits(new Set([planPublicado.unidades[0].id]))
        } else {
          setOpenUnits(new Set())
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.mensaje || 'No se pudo cargar los temas del curso.')
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    cargar()

    return () => {
      cancelado = true
    }
  }, [cursoId])

  const planEnriquecido = useMemo(
    () => (plan ? enriquecerPlan(plan, progreso?.porTema ?? []) : null),
    [plan, progreso],
  )

  const temasPlan = useMemo(
    () => flattenTemas(planEnriquecido?.unidades ?? []),
    [planEnriquecido],
  )

  const progresoGeneral = useMemo(
    () => calcularProgresoGeneral(temasPlan),
    [temasPlan],
  )

  const proximosTemas = useMemo(
    () =>
      temasPlan
        .filter((tema) => tema.estadoEstudiante !== 'COMPLETADO')
        .slice(0, 5),
    [temasPlan],
  )

  const temasReforzar = useMemo(() => {
    const porDominio = temasPlan
      .filter(
        (tema) =>
          tema.estadoEstudiante !== 'COMPLETADO' &&
          tema.porcentajeDominio != null &&
          tema.porcentajeDominio < UMBRAL_DOMINIO,
      )
      .sort((a, b) => a.porcentajeDominio - b.porcentajeDominio)

    if (porDominio.length > 0) {
      return porDominio.slice(0, 5)
    }

    return (progreso?.temasPorReforzar ?? [])
      .map((item) => {
        const temaPlan = temasPlan.find(
          (tema) => normalizarTema(tema.titulo) === normalizarTema(item.tema),
        )
        if (!temaPlan) return null
        return {
          ...temaPlan,
          porcentajeDominio: item.porcentajeDominio,
        }
      })
      .filter(Boolean)
      .slice(0, 5)
  }, [temasPlan, progreso])

  const toggleUnit = (unidadId) => {
    setOpenUnits((prev) => {
      const next = new Set(prev)
      if (next.has(unidadId)) next.delete(unidadId)
      else next.add(unidadId)
      return next
    })
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Mis cursos" title="Temas del curso" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando temas del curso…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader
          eyebrow="Mis cursos"
          title="Temas del curso"
          actions={
            <Button variant="ghost" onClick={() => navigate('/estudiante/cursos')}>
              ← Volver a mis cursos
            </Button>
          }
        />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </>
    )
  }

  if (!planEnriquecido) {
    return (
      <>
        <PageHeader
          eyebrow="Mis cursos"
          title={curso?.nombre ?? 'Temas del curso'}
          subtitle={curso?.docente?.nombres ?? 'Docente'}
          actions={
            <Button variant="ghost" onClick={() => navigate('/estudiante/cursos')}>
              ← Volver a mis cursos
            </Button>
          }
        />
        <div className={styles.emptyNotice}>
          <p>
            El docente todavía no ha publicado un plan curricular para este curso.
            Cuando lo haga, podrás consultar aquí las unidades, temas y subtemas.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/estudiante/cursos')}>
            Volver a mis cursos
          </Button>
        </div>
      </>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Mis cursos"
        title={curso?.nombre ?? 'Temas del curso'}
        subtitle={curso?.docente?.nombres ?? 'Docente'}
        actions={
          <Button variant="ghost" onClick={() => navigate('/estudiante/cursos')}>
            ← Volver a mis cursos
          </Button>
        }
      />

      <Card className={styles.summaryCard}>
        <div className={styles.courseMeta}>
          <span className={styles.metaBadge}>
            Periodo académico: {PERIODOS[planEnriquecido.periodo] ?? planEnriquecido.periodo}
          </span>
          <span className={styles.metaBadge}>
            {planEnriquecido.unidades?.length ?? 0} unidad(es)
          </span>
        </div>

        <div className={styles.progressBlock}>
          <div className={styles.progressHead}>
            <span>
              Progreso general del curso:{' '}
              <strong>{progresoGeneral.porcentaje}%</strong>
            </span>
            <span>
              {progresoGeneral.completados} de {progresoGeneral.total} temas completados
            </span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${progresoGeneral.porcentaje}%` }}
            />
          </div>
          <div className={styles.progressStats}>
            <span>
              Evaluaciones finalizadas:{' '}
              <strong>{progreso?.evaluacionesRealizadas ?? 0}</strong>
            </span>
            {progreso?.promedioPorcentaje != null && (
              <span>
                Promedio del curso:{' '}
                <strong>{progreso.promedioPorcentaje}%</strong>
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className={styles.sectionsGrid}>
        <Card title="Próximos temas a trabajar">
          {proximosTemas.length > 0 ? (
            <ul className={styles.sectionList}>
              {proximosTemas.map((tema) => (
                <li key={tema.id} className={styles.sectionItem}>
                  <p className={styles.sectionItemTitle}>{tema.titulo}</p>
                  <p className={styles.sectionItemMeta}>
                    {tema.unidadTitulo} ·{' '}
                    {ESTADOS_ESTUDIANTE[tema.estadoEstudiante]?.label ?? 'Pendiente'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptySection}>
              Has completado todos los temas del plan curricular publicado.
            </p>
          )}
        </Card>

        <Card title="Temas que necesitas reforzar">
          {temasReforzar.length > 0 ? (
            <ul className={styles.sectionList}>
              {temasReforzar.map((tema) => (
                <li key={tema.id} className={styles.sectionItem}>
                  <p className={styles.sectionItemTitle}>{tema.titulo}</p>
                  <p className={styles.sectionItemMeta}>
                    {tema.unidadTitulo}
                    {tema.porcentajeDominio != null
                      ? ` · Dominio: ${tema.porcentajeDominio}%`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptySection}>
              No hay temas pendientes de refuerzo según tus evaluaciones.
            </p>
          )}
        </Card>
      </div>

      <Card
        title="Plan curricular"
        subtitle="Consulta las unidades, temas y subtemas publicados por tu docente"
      >
        {planEnriquecido.unidades?.length ? (
          <div className={styles.accordion}>
            {planEnriquecido.unidades.map((unidad) => {
              const abierta = openUnits.has(unidad.id)
              const temasUnidad = unidad.temas ?? []
              const completadosUnidad = temasUnidad.filter(
                (tema) => tema.estadoEstudiante === 'COMPLETADO',
              ).length

              return (
                <section key={unidad.id} className={styles.unitCard}>
                  <button
                    type="button"
                    className={`${styles.unitHeader} ${abierta ? styles.unitHeaderOpen : ''}`}
                    onClick={() => toggleUnit(unidad.id)}
                    aria-expanded={abierta}
                  >
                    <div>
                      <h3 className={styles.unitTitle}>{unidad.titulo}</h3>
                      <p className={styles.unitMeta}>
                        {temasUnidad.length} tema(s) · {completadosUnidad} completado(s)
                      </p>
                    </div>
                    <svg
                      className={`${styles.chevron} ${abierta ? styles.chevronOpen : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {abierta && (
                    <div className={styles.unitBody}>
                      {unidad.descripcion && (
                        <p className={styles.unitDescription}>{unidad.descripcion}</p>
                      )}

                      {temasUnidad.length === 0 ? (
                        <p className={styles.emptySection}>
                          Esta unidad aún no tiene temas registrados.
                        </p>
                      ) : (
                        temasUnidad.map((tema) => (
                          <article key={tema.id} className={styles.topicCard}>
                            <div className={styles.topicHeader}>
                              <h4 className={styles.topicTitle}>{tema.titulo}</h4>
                              <EstadoBadge estado={tema.estadoEstudiante} />
                            </div>

                            {tema.descripcion && (
                              <p className={styles.topicDescription}>{tema.descripcion}</p>
                            )}

                            <div className={styles.topicProgress}>
                              {tema.porcentajeDominio != null && (
                                <span>
                                  Dominio: <strong>{tema.porcentajeDominio}%</strong>
                                </span>
                              )}
                              {tema.promedioEvaluaciones != null && (
                                <span>
                                  Promedio evaluaciones:{' '}
                                  <strong>{tema.promedioEvaluaciones}%</strong>
                                </span>
                              )}
                              {tema.evaluacionesFinalizadas > 0 && (
                                <span>
                                  Evaluaciones finalizadas:{' '}
                                  <strong>{tema.evaluacionesFinalizadas}</strong>
                                </span>
                              )}
                            </div>

                            {(tema.subtemas ?? []).length > 0 && (
                              <div className={styles.subtopicList}>
                                {(tema.subtemas ?? []).map((subtema) => (
                                  <div key={subtema.id} className={styles.subtopicItem}>
                                    <p className={styles.subtopicTitle}>{subtema.titulo}</p>
                                    {subtema.descripcion && (
                                      <p className={styles.subtopicDescription}>
                                        {subtema.descripcion}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </article>
                        ))
                      )}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <p className={styles.emptySection}>
            El plan curricular publicado no tiene unidades registradas.
          </p>
        )}
      </Card>
    </div>
  )
}

export default TemasDelCurso
