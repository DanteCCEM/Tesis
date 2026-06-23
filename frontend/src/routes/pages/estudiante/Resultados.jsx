import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import iaService from '../../../services/iaService.js'
import intentosService from '../../../services/intentosService.js'
import styles from './Resultados.module.css'

const NIVEL_LABEL = {
  BASICO: 'Nivel básico',
  INTERMEDIO: 'Nivel intermedio',
  AVANZADO: 'Nivel avanzado',
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function normalizarRetroalimentacion(payload) {
  if (!payload || typeof payload !== 'object') return null
  const {
    fortalezas,
    temasPorReforzar,
    explicacionErroresFrecuentes,
    recomendacionEstudio,
    siguienteNivelSugerido,
  } = payload
  if (
    !Array.isArray(fortalezas) ||
    !Array.isArray(temasPorReforzar) ||
    !explicacionErroresFrecuentes ||
    !recomendacionEstudio ||
    !siguienteNivelSugerido
  ) {
    return null
  }
  return {
    fortalezas,
    temasPorReforzar,
    explicacionErroresFrecuentes,
    recomendacionEstudio,
    siguienteNivelSugerido,
    generadoPorIA: payload.generadoPorIA !== false,
  }
}

function buildPayloadRetroalimentacion(resultado) {
  const respuestas = resultado.respuestas ?? []
  const correctas = respuestas.filter((r) => r.esCorrecta)
  const incorrectas = respuestas.filter((r) => !r.esCorrecta)
  const temas = [...new Set(respuestas.map((r) => r.tema).filter(Boolean))]
  const subtemaEval = resultado.evaluacion?.subtema?.trim()
  const subtemas = [
    ...(subtemaEval ? [subtemaEval] : []),
    ...temas,
  ].filter((item, index, arr) => arr.indexOf(item) === index)

  const nivelAdaptativo =
    resultado.adaptativo?.nivel ?? resultado.nivelObtenido ?? 'BASICO'

  return {
    intentoId: resultado.intentoId,
    resultadoEvaluacion: [
      `Porcentaje: ${Math.round(resultado.porcentaje ?? 0)}%.`,
      `Preguntas correctas: ${correctas.length} de ${respuestas.length}.`,
      `Puntaje obtenido: ${resultado.nota ?? 0}.`,
      `Nivel alcanzado: ${resultado.nivelObtenido ?? nivelAdaptativo}.`,
      `Tema de la evaluación: ${resultado.evaluacion?.tema ?? 'General'}.`,
    ].join(' '),
    preguntasFalladas: incorrectas.map((r) => ({
      enunciado: r.enunciado,
      tema: r.tema,
      respuestaDada: r.tuRespuesta || 'Sin respuesta',
    })),
    temas,
    subtemas: subtemas.length > 0 ? subtemas : temas,
    porcentajeObtenido: Number(resultado.porcentaje ?? 0),
    nivelAdaptativo,
  }
}

function buildRetroalimentacionReglas(resultado) {
  const adapt = resultado.adaptativo ?? {}
  const temasDominados = adapt.temasDominados ?? resultado.temasCorrectos ?? []
  const temasPorReforzar =
    adapt.temasPorReforzar ?? resultado.temasPorReforzar ?? []
  const erroresPorTema = adapt.errores?.porTema ?? []
  const temasConErrores = erroresPorTema
    .filter((t) => t.errores > 0)
    .map((t) => t.tema)

  const fortalezas =
    temasDominados.length > 0
      ? temasDominados.map((tema) => `Demostraste buen dominio en ${tema}.`)
      : [
          'Completaste la evaluación y diste un paso importante en tu aprendizaje.',
        ]

  const explicacionErroresFrecuentes =
    temasConErrores.length > 0
      ? `Los errores se concentraron en: ${temasConErrores.join(', ')}. Repasa los conceptos clave de esos temas.`
      : 'Revisa las preguntas marcadas como incorrectas para identificar detalles por afianzar.'

  const recomendacion = adapt.recomendaciones
  const acciones = recomendacion?.acciones ?? []

  return {
    fortalezas,
    temasPorReforzar,
    explicacionErroresFrecuentes,
    recomendacionEstudio: [
      adapt.mensaje,
      recomendacion?.descripcion,
      acciones.length > 0 ? `Acciones sugeridas: ${acciones.join(' ')}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    siguienteNivelSugerido: adapt.nivel ?? resultado.nivelObtenido ?? 'BASICO',
    generadoPorIA: false,
  }
}

function EstudianteResultados() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const intentoId = location.state?.intentoId ?? searchParams.get('intentoId')

  const [resultado, setResultado] = useState(null)
  const [retroalimentacion, setRetroalimentacion] = useState(null)
  const [loading, setLoading] = useState(Boolean(intentoId))
  const [loadingIA, setLoadingIA] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!intentoId) return undefined
    let cancelado = false

    intentosService
      .obtenerResultados(intentoId)
      .then(async (data) => {
        if (cancelado) return
        setResultado(data)
        setError('')

        const guardada = normalizarRetroalimentacion(data.retroalimentacionIA)
        if (guardada) {
          setRetroalimentacion(guardada)
          return
        }

        setLoadingIA(true)
        try {
          const respuesta = await iaService.generarRetroalimentacion(
            buildPayloadRetroalimentacion(data),
          )
          if (cancelado) return
          const generada = normalizarRetroalimentacion(respuesta.retroalimentacion)
          setRetroalimentacion(generada ?? buildRetroalimentacionReglas(data))
        } catch {
          if (cancelado) return
          setRetroalimentacion(buildRetroalimentacionReglas(data))
        } finally {
          if (!cancelado) setLoadingIA(false)
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err.mensaje || 'No se pudieron cargar los resultados.')
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [intentoId])

  const data = useMemo(() => {
    if (!resultado) return null

    const detalles = resultado.respuestas ?? []
    const correct = detalles.filter((r) => r.esCorrecta).length
    const total = detalles.length
    const incorrect = total - correct
    const percentage = Math.round(resultado.porcentaje ?? 0)
    const score20 = Math.round((resultado.porcentaje ?? 0) / 5)

    return {
      total,
      correct,
      incorrect,
      percentage,
      score20,
      puntaje: resultado.nota ?? 0,
      mastered: resultado.temasCorrectos ?? [],
      toReinforce: resultado.temasPorReforzar ?? [],
      levelLabel: NIVEL_LABEL[resultado.nivelObtenido] ?? 'Nivel',
      details: detalles,
      title: resultado.evaluacion?.titulo ?? 'Resultados',
      topic: resultado.evaluacion?.tema ?? '',
    }
  }, [resultado])

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Resultados" title="Resultados de la evaluación" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando tus resultados…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Resultados" title="Resultados de la evaluación" />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              setError('')
              intentosService
                .obtenerResultados(intentoId)
                .then(setResultado)
                .catch((err) =>
                  setError(err.mensaje || 'No se pudieron cargar los resultados.'),
                )
                .finally(() => setLoading(false))
            }}
          >
            Reintentar
          </Button>
        </div>
      </>
    )
  }

  if (!intentoId || !data) {
    return (
      <>
        <PageHeader eyebrow="Resultados" title="Resultados de la evaluación" />
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>No hay resultados para mostrar</h2>
          <p className={styles.stateText}>
            Resuelve y finaliza una evaluación para ver tus resultados aquí.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/estudiante/cursos')}
          >
            Ir a mis cursos
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Resultados"
        title={data.title}
        subtitle={data.topic}
        actions={
          <Button variant="outline" onClick={() => navigate('/estudiante/progreso')}>
            Ver mi progreso
          </Button>
        }
      />

      <div className={styles.summary}>
        <div className={styles.scoreCard}>
          <div className={styles.scoreRing}>
            <span className={styles.scoreValue}>{data.score20}/20</span>
            <span className={styles.scoreMax}>{data.percentage}% aciertos</span>
          </div>
          <div className={styles.scoreInfo}>
            <h2>¡Evaluación completada!</h2>
            <p>
              Acertaste {data.correct} de {data.total} preguntas.
            </p>
            <span className={styles.levelTag}>{data.levelLabel}</span>
          </div>
        </div>

        <div className={styles.miniStats}>
          <div className={styles.miniStat}>
            <span className={`${styles.miniValue} ${styles.correct}`}>
              {data.correct}
            </span>
            <span className={styles.miniLabel}>Respuestas correctas</span>
          </div>
          <div className={styles.miniStat}>
            <span className={`${styles.miniValue} ${styles.incorrect}`}>
              {data.incorrect}
            </span>
            <span className={styles.miniLabel}>Respuestas incorrectas</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.percentage}%</span>
            <span className={styles.miniLabel}>Porcentaje de aciertos</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.puntaje}</span>
            <span className={styles.miniLabel}>Puntaje obtenido</span>
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        <Card title="Detalle de preguntas" subtitle="Estado de cada respuesta">
          {data.details.map((detail, index) => (
            <div key={detail.preguntaId} className={styles.questionItem}>
              <span
                className={`${styles.statusIcon} ${
                  detail.esCorrecta ? styles.statusOk : styles.statusBad
                }`}
              >
                {detail.esCorrecta ? <CheckIcon /> : <CrossIcon />}
              </span>
              <div className={styles.qInfo}>
                <p className={styles.qInfoText}>
                  {index + 1}. {detail.enunciado}
                </p>
                <p className={styles.qInfoMeta}>
                  {detail.tema} · Tu respuesta: {detail.tuRespuesta || '—'}
                </p>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <Card title="Temas dominados">
            {data.mastered.length > 0 ? (
              <div className={styles.chips}>
                {data.mastered.map((topic) => (
                  <span key={topic} className={`${styles.chip} ${styles.chipOk}`}>
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.emptyChips}>
                Aún no dominas ningún tema por completo. ¡Sigue practicando!
              </p>
            )}
          </Card>

          <Card title="Temas que necesitas reforzar">
            {data.toReinforce.length > 0 ? (
              <div className={styles.chips}>
                {data.toReinforce.map((topic) => (
                  <span key={topic} className={`${styles.chip} ${styles.chipBad}`}>
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.emptyChips}>
                ¡Excelente! No tienes temas pendientes de refuerzo.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Card
        title="Retroalimentación personalizada"
        subtitle={
          loadingIA
            ? 'Generando orientación pedagógica…'
            : retroalimentacion?.generadoPorIA
              ? 'Generada con inteligencia artificial'
              : 'Basada en tu desempeño'
        }
      >
        {loadingIA ? (
          <div className={styles.iaLoading} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.stateText}>
              Estamos preparando recomendaciones breves y motivadoras para ti…
            </p>
          </div>
        ) : retroalimentacion ? (
          <div className={styles.iaFeedback}>
            <section className={styles.iaSection}>
              <h3 className={styles.iaSectionTitle}>Fortalezas</h3>
              <ul className={styles.iaList}>
                {retroalimentacion.fortalezas.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className={styles.iaSection}>
              <h3 className={styles.iaSectionTitle}>Temas por reforzar</h3>
              {retroalimentacion.temasPorReforzar.length > 0 ? (
                <div className={styles.chips}>
                  {retroalimentacion.temasPorReforzar.map((tema) => (
                    <span key={tema} className={`${styles.chip} ${styles.chipBad}`}>
                      {tema}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyChips}>
                  ¡Muy bien! No hay temas urgentes por reforzar.
                </p>
              )}
            </section>

            <section className={styles.iaSection}>
              <h3 className={styles.iaSectionTitle}>Errores frecuentes</h3>
              <p className={styles.feedback}>
                {retroalimentacion.explicacionErroresFrecuentes}
              </p>
            </section>

            <section className={styles.iaSection}>
              <h3 className={styles.iaSectionTitle}>Plan de estudio recomendado</h3>
              <div className={styles.recommendation}>
                <span className={styles.recIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <p className={styles.recText}>{retroalimentacion.recomendacionEstudio}</p>
              </div>
            </section>

            <section className={styles.iaSection}>
              <h3 className={styles.iaSectionTitle}>Nivel sugerido</h3>
              <span className={styles.levelSuggested}>
                {NIVEL_LABEL[retroalimentacion.siguienteNivelSugerido] ??
                  retroalimentacion.siguienteNivelSugerido}
              </span>
            </section>
          </div>
        ) : (
          <p className={styles.emptyChips}>
            No se pudo cargar la retroalimentación en este momento.
          </p>
        )}
      </Card>

      <div className={styles.actions}>
        <Button variant="primary" onClick={() => navigate('/estudiante/progreso')}>
          Ver mi progreso
        </Button>
        <Button variant="outline" onClick={() => navigate('/estudiante/cursos')}>
          Ir a mis cursos
        </Button>
      </div>
    </>
  )
}

export default EstudianteResultados
