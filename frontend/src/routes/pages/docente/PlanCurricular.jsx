import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import planCurricularService from '../../../services/planCurricularService.js'
import styles from './PlanCurricular.module.css'

const PERIODOS = [
  { value: 'SEMESTRE', label: 'Semestre' },
  { value: 'TRIMESTRE', label: 'Trimestre' },
  { value: 'BIMESTRE', label: 'Bimestre' },
]

function formatPeriodo(valor) {
  return PERIODOS.find((p) => p.value === valor)?.label ?? valor
}

function elegirPlanPorPeriodo(planes = [], periodo) {
  const delPeriodo = planes.filter((plan) => plan.periodo === periodo)
  if (!delPeriodo.length) return null

  const publicado = delPeriodo.find((plan) => plan.estado === 'PUBLICADO')
  if (publicado) return publicado

  return [...delPeriodo].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )[0]
}

function contarTemas(unidades = []) {
  return unidades.reduce((acc, unidad) => acc + (unidad.temas?.length ?? 0), 0)
}

function PlanCurricular() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [cursos, setCursos] = useState([])
  const [planesPorCurso, setPlanesPorCurso] = useState({})
  const [periodo, setPeriodo] = useState(
    searchParams.get('periodo')?.toUpperCase() || 'SEMESTRE',
  )
  const [cursoId, setCursoId] = useState(
    () => Number(searchParams.get('curso')) || null,
  )
  const [openUnits, setOpenUnits] = useState({})

  const [loading, setLoading] = useState(true)
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [error, setError] = useState('')

  const cargarPlanes = useCallback(async (listaCursos) => {
    if (!listaCursos.length) {
      setPlanesPorCurso({})
      return
    }

    setLoadingPlanes(true)
    try {
      const entradas = await Promise.all(
        listaCursos.map(async (curso) => {
          const planes = await planCurricularService.listarPorCurso(curso.id)
          return [curso.id, planes]
        }),
      )
      setPlanesPorCurso(Object.fromEntries(entradas))
    } catch (err) {
      setError(err.mensaje || 'No se pudieron cargar los planes curriculares.')
    } finally {
      setLoadingPlanes(false)
    }
  }, [])

  const cargarTodo = useCallback(async () => {
    setError('')
    setLoadingPlanes(true)
    try {
      const lista = await cursosService.misCursos()
      setCursos(lista)
      await cargarPlanes(lista)
    } catch (err) {
      setError(err.mensaje || 'No se pudieron cargar tus cursos.')
    } finally {
      setLoadingPlanes(false)
    }
  }, [cargarPlanes])

  useEffect(() => {
    let cancelado = false

    const iniciar = async () => {
      setLoading(true)
      setError('')
      try {
        const lista = await cursosService.misCursos()
        if (cancelado) return

        setCursos(lista)

        const idEnUrl = Number(searchParams.get('curso'))
        const periodoUrl = searchParams.get('periodo')?.toUpperCase()
        if (periodoUrl && PERIODOS.some((p) => p.value === periodoUrl)) {
          setPeriodo(periodoUrl)
        }

        if (lista.length > 0) {
          const existe = lista.some((c) => c.id === idEnUrl)
          setCursoId(existe ? idEnUrl : lista[0].id)
        }

        await cargarPlanes(lista)
      } catch (err) {
        if (!cancelado) {
          setError(err.mensaje || 'No se pudieron cargar tus cursos.')
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    iniciar()

    return () => {
      cancelado = true
    }
    // Solo al montar; "Actualizar" usa cargarTodo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const params = { periodo }
    if (cursoId) params.curso = String(cursoId)
    setSearchParams(params, { replace: true })
  }, [cursoId, periodo, setSearchParams])

  const cursoActivo = useMemo(
    () => cursos.find((c) => c.id === cursoId) ?? null,
    [cursos, cursoId],
  )

  const planActivo = useMemo(() => {
    if (!cursoId) return null
    const planes = planesPorCurso[cursoId] ?? []
    return elegirPlanPorPeriodo(planes, periodo)
  }, [cursoId, planesPorCurso, periodo])

  const unidades = planActivo?.unidades ?? []
  const totalTemas = contarTemas(unidades)

  const seleccionarCurso = (id) => {
    setCursoId(id)
    setOpenUnits({})
  }

  const seleccionarPeriodo = (valor) => {
    setPeriodo(valor)
    setOpenUnits({})
  }

  const toggleUnit = (unidadId) => {
    setOpenUnits((prev) => ({ ...prev, [unidadId]: !prev[unidadId] }))
  }

  const irGestionarPlan = () => {
    if (!cursoId) return
    navigate(`/docente/cursos/${cursoId}/plan-curricular`)
  }

  const planResumenCurso = (id) => {
    const plan = elegirPlanPorPeriodo(planesPorCurso[id] ?? [], periodo)
    if (!plan) return 'Sin plan'
    const temas = contarTemas(plan.unidades)
    return `${plan.estado === 'PUBLICADO' ? 'Publicado' : 'Borrador'} · ${temas} tema(s)`
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Plan curricular" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando cursos y planes…</p>
        </div>
      </>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Panel docente"
        title="Plan curricular"
        subtitle="Consulta los temas a trabajar por curso y periodo académico. Los contenidos se sincronizan con los PDF que subes en cada curso."
        actions={
          <Button variant="outline" onClick={cargarTodo} disabled={loadingPlanes}>
            {loadingPlanes ? 'Actualizando…' : 'Actualizar'}
          </Button>
        }
      />

      {error && (
        <div className={styles.feedbackError} role="alert">
          {error}
        </div>
      )}

      <Card title="Periodo académico">
        <div className={styles.periodTabs} role="tablist" aria-label="Periodo académico">
          {PERIODOS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={periodo === item.value}
              className={`${styles.periodTab} ${
                periodo === item.value ? styles.periodTabActive : ''
              }`}
              onClick={() => seleccionarPeriodo(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {cursos.length === 0 ? (
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Aún no tienes cursos</h2>
          <p className={styles.stateText}>
            Crea un curso en Mis cursos para comenzar a planificar temas.
          </p>
          <Button variant="primary" onClick={() => navigate('/docente/cursos')}>
            Ir a Mis cursos
          </Button>
        </div>
      ) : (
        <div className={styles.layout}>
          <Card title="Mis cursos">
            <div className={styles.courseList}>
              {cursos.map((curso) => {
                const activo = curso.id === cursoId
                const plan = elegirPlanPorPeriodo(planesPorCurso[curso.id] ?? [], periodo)
                return (
                  <button
                    key={curso.id}
                    type="button"
                    className={`${styles.courseItem} ${
                      activo ? styles.courseItemActive : ''
                    }`}
                    onClick={() => seleccionarCurso(curso.id)}
                  >
                    <p className={styles.courseItemName}>{curso.nombre}</p>
                    <p className={styles.courseItemMeta}>
                      {curso.grado} {curso.seccion}
                    </p>
                    <span
                      className={`${styles.courseItemBadge} ${
                        plan?.estado === 'PUBLICADO' ? styles.courseItemBadgeOk : ''
                      }`}
                    >
                      {planResumenCurso(curso.id)}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          <div className={styles.detailPanel}>
            {cursoActivo && (
              <Card>
                <div className={styles.detailHead}>
                  <div>
                    <h2 className={styles.detailTitle}>{cursoActivo.nombre}</h2>
                    <p className={styles.detailMeta}>
                      Periodo: {formatPeriodo(periodo)} · {cursoActivo.grado}{' '}
                      {cursoActivo.seccion}
                    </p>
                  </div>
                  <Button variant="primary" onClick={irGestionarPlan}>
                    Gestionar plan (subir PDF)
                  </Button>
                </div>
              </Card>
            )}

            {loadingPlanes ? (
              <div className={styles.state}>
                <span className={styles.spinner} aria-hidden="true" />
                <p className={styles.stateText}>Sincronizando plan del curso…</p>
              </div>
            ) : !planActivo ? (
              <div className={styles.emptyPlan}>
                <h3 className={styles.emptyPlanTitle}>
                  No hay plan para este {formatPeriodo(periodo).toLowerCase()}
                </h3>
                <p className={styles.emptyPlanText}>
                  Sube un PDF del plan curricular para {cursoActivo?.nombre ?? 'este curso'}.
                  Después de analizarlo con IA, los temas aparecerán aquí automáticamente.
                </p>
                <Button variant="primary" onClick={irGestionarPlan}>
                  Subir plan curricular
                </Button>
              </div>
            ) : (
              <Card title="Temas a trabajar">
                <div className={styles.detailHead}>
                  <div className={styles.statsRow}>
                    <span
                      className={`${styles.badge} ${
                        planActivo.estado === 'PUBLICADO'
                          ? styles.badgePublished
                          : styles.badgeDraft
                      }`}
                    >
                      {planActivo.estado === 'PUBLICADO' ? 'Publicado' : 'Borrador'}
                    </span>
                    <span>
                      Archivo: <strong>{planActivo.nombreArchivo}</strong>
                    </span>
                    <span>
                      Unidades: <strong>{unidades.length}</strong>
                    </span>
                    <span>
                      Temas: <strong>{totalTemas}</strong>
                    </span>
                  </div>
                </div>

                {unidades.length === 0 ? (
                  <div className={styles.emptyPlan}>
                    <h3 className={styles.emptyPlanTitle}>Plan sin estructura</h3>
                    <p className={styles.emptyPlanText}>
                      El PDF está subido pero aún no tiene unidades ni temas. Analízalo con IA
                      o edítalo manualmente.
                    </p>
                    <Button variant="outline" onClick={irGestionarPlan}>
                      Completar plan
                    </Button>
                  </div>
                ) : (
                  <div className={styles.accordion}>
                    {unidades.map((unidad, uIndex) => {
                      const abierta = Boolean(openUnits[unidad.id])
                      const temas = unidad.temas ?? []
                      return (
                        <section key={unidad.id} className={styles.unitCard}>
                          <button
                            type="button"
                            className={`${styles.unitHeader} ${
                              abierta ? styles.unitHeaderOpen : ''
                            }`}
                            onClick={() => toggleUnit(unidad.id)}
                            aria-expanded={abierta}
                          >
                            <div>
                              <h3 className={styles.unitTitle}>
                                {unidad.titulo || `Unidad ${uIndex + 1}`}
                              </h3>
                              <p className={styles.unitMeta}>{temas.length} tema(s)</p>
                            </div>
                            <svg
                              className={`${styles.chevron} ${
                                abierta ? styles.chevronOpen : ''
                              }`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
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

                              {temas.map((tema) => (
                                <article key={tema.id} className={styles.topicCard}>
                                  <h4 className={styles.topicTitle}>{tema.titulo}</h4>
                                  {tema.descripcion && (
                                    <p className={styles.topicDescription}>{tema.descripcion}</p>
                                  )}

                                  {(tema.subtemas ?? []).length > 0 && (
                                    <div className={styles.subtopicList}>
                                      {(tema.subtemas ?? []).map((subtema) => (
                                        <div key={subtema.id} className={styles.subtopicItem}>
                                          {subtema.titulo}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </article>
                              ))}
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanCurricular
