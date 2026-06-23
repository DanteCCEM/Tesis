import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Modal, PageHeader } from '../../../components/index.js'
import evaluacionesService from '../../../services/evaluacionesService.js'
import intentosService from '../../../services/intentosService.js'
import styles from './Evaluacion.module.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const OPCION_TIPOS = ['OPCION_MULTIPLE', 'VERDADERO_FALSO']

function tieneRespuesta(answer, tipo) {
  if (!answer) return false
  if (OPCION_TIPOS.includes(tipo)) return answer.alternativaId != null
  return Boolean(answer.respuestaTexto && answer.respuestaTexto.trim())
}

function EstudianteEvaluacion() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const evaluacionId =
    location.state?.evaluacionId ?? searchParams.get('evaluacionId')
  const practicaResumen = location.state?.practicaResumen ?? null

  const [loading, setLoading] = useState(Boolean(evaluacionId))
  const [error, setError] = useState('')
  const [intentoId, setIntentoId] = useState(null)
  const [evaluacion, setEvaluacion] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [current, setCurrent] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState('')

  const iniciar = useCallback(async () => {
    if (!evaluacionId) return
    try {
      const data = await evaluacionesService.iniciar(evaluacionId)
      setIntentoId(data.intento.id)
      setEvaluacion(data.evaluacion)
      setQuestions(data.evaluacion?.preguntas ?? [])

      const inicial = {}
      for (const r of data.respuestasGuardadas ?? []) {
        inicial[r.preguntaId] = {
          alternativaId: r.alternativaId ?? null,
          respuestaTexto: r.respuestaTexto ?? '',
        }
      }
      setAnswers(inicial)
      setCurrent(0)
      setError('')
    } catch (err) {
      setError(err.mensaje || 'No se pudo iniciar la evaluación.')
    } finally {
      setLoading(false)
    }
  }, [evaluacionId])

  const reintentar = () => {
    setLoading(true)
    iniciar()
  }

  useEffect(() => {
    if (!evaluacionId) return undefined
    let cancelado = false
    evaluacionesService
      .iniciar(evaluacionId)
      .then((data) => {
        if (cancelado) return
        setIntentoId(data.intento.id)
        setEvaluacion(data.evaluacion)
        setQuestions(data.evaluacion?.preguntas ?? [])
        const inicial = {}
        for (const r of data.respuestasGuardadas ?? []) {
          inicial[r.preguntaId] = {
            alternativaId: r.alternativaId ?? null,
            respuestaTexto: r.respuestaTexto ?? '',
          }
        }
        setAnswers(inicial)
        setCurrent(0)
        setError('')
      })
      .catch((err) => {
        if (!cancelado) setError(err.mensaje || 'No se pudo iniciar la evaluación.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [evaluacionId])

  const answeredCount = useMemo(
    () =>
      questions.filter((q) => tieneRespuesta(answers[q.id], q.tipo)).length,
    [answers, questions],
  )

  const progress =
    questions.length > 0
      ? Math.round((answeredCount / questions.length) * 100)
      : 0
  const question = questions[current]
  const isLast = current === questions.length - 1

  const goPrev = () => setCurrent((i) => Math.max(0, i - 1))
  const goNext = () =>
    setCurrent((i) => Math.min(questions.length - 1, i + 1))

  // Guarda una respuesta en el backend (autosave).
  const guardar = useCallback(
    async (preguntaId, payload) => {
      if (!intentoId) return
      try {
        await intentosService.guardarRespuesta(intentoId, {
          preguntaId,
          ...payload,
        })
        setSaveError('')
      } catch (err) {
        setSaveError(err.mensaje || 'No se pudo guardar la respuesta.')
      }
    },
    [intentoId],
  )

  const selectOption = (pregunta, alternativaId) => {
    setAnswers((prev) => ({
      ...prev,
      [pregunta.id]: { alternativaId, respuestaTexto: '' },
    }))
    guardar(pregunta.id, { alternativaId })
  }

  const setTexto = (pregunta, texto) => {
    setAnswers((prev) => ({
      ...prev,
      [pregunta.id]: { alternativaId: null, respuestaTexto: texto },
    }))
  }

  const guardarTexto = (pregunta) => {
    const texto = answers[pregunta.id]?.respuestaTexto
    if (texto && texto.trim()) {
      guardar(pregunta.id, { respuestaTexto: texto })
    }
  }

  const handleFinish = async () => {
    if (!intentoId) return
    setSubmitting(true)
    setSaveError('')
    try {
      // Asegura que todas las respuestas estén persistidas antes de corregir.
      for (const q of questions) {
        const answer = answers[q.id]
        if (!tieneRespuesta(answer, q.tipo)) continue
        if (OPCION_TIPOS.includes(q.tipo)) {
          await intentosService.guardarRespuesta(intentoId, {
            preguntaId: q.id,
            alternativaId: answer.alternativaId,
          })
        } else {
          await intentosService.guardarRespuesta(intentoId, {
            preguntaId: q.id,
            respuestaTexto: answer.respuestaTexto,
          })
        }
      }

      await intentosService.finalizar(intentoId)
      setConfirmOpen(false)
      navigate('/estudiante/resultados', { state: { intentoId } })
    } catch (err) {
      setSaveError(err.mensaje || 'No se pudo finalizar la evaluación.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Evaluación en curso" title="Evaluación" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Preparando tu evaluación…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Evaluación en curso" title="Evaluación" />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>No se pudo iniciar</h2>
          <p className={styles.stateText}>{error}</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={reintentar}>
              Reintentar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/estudiante/cursos')}
            >
              Volver a mis cursos
            </Button>
          </div>
        </div>
      </>
    )
  }

  if (!evaluacionId || !evaluacion) {
    return (
      <>
        <PageHeader eyebrow="Evaluación en curso" title="Evaluación" />
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>No hay una evaluación seleccionada</h2>
          <p className={styles.stateText}>
            Elige una evaluación desde tus cursos para comenzar.
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

  if (questions.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Evaluación en curso" title={evaluacion.titulo} />
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Esta evaluación aún no tiene preguntas</h2>
          <p className={styles.stateText}>
            Vuelve más tarde cuando el docente haya agregado preguntas.
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
        eyebrow={practicaResumen ? 'Práctica adaptativa' : 'Evaluación en curso'}
        title={evaluacion.titulo}
        subtitle={
          practicaResumen
            ? 'Práctica personalizada según tu progreso reciente.'
            : 'Responde cada pregunta. Tus respuestas se guardan automáticamente mientras avanzas.'
        }
      />

      {practicaResumen && (
        <div className={styles.practiceBanner} role="status">
          <p className={styles.practiceBannerTitle}>{practicaResumen.titulo}</p>
          <p className={styles.practiceBannerText}>{practicaResumen.descripcion}</p>
          <p className={styles.practiceBannerMeta}>
            Dificultad: <strong>{practicaResumen.dificultadPracticaLabel}</strong>
            {' · '}
            Enfoque: {practicaResumen.enfoque}
          </p>
        </div>
      )}

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 3h5l1 4h4v13H5V7h3.5l1-4Z" />
          </svg>
          Tema: <strong>{evaluacion.tema}</strong>
        </span>
        {evaluacion.subtema && (
          <span className={styles.metaItem}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            Subtema: <strong>{evaluacion.subtema}</strong>
          </span>
        )}
        <span className={styles.metaItem}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z" />
          </svg>
          Preguntas: <strong>{questions.length}</strong>
        </span>
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.progressHead}>
          <span>
            Pregunta {current + 1} de {questions.length}
          </span>
          <span>{answeredCount} respondidas</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={styles.questionCard}>
        <p className={styles.qNumber}>Pregunta {current + 1}</p>
        <h2 className={styles.qText}>{question.enunciado}</h2>

        {OPCION_TIPOS.includes(question.tipo) ? (
          <div className={styles.options}>
            {question.alternativas.map((option, idx) => {
              const selected = answers[question.id]?.alternativaId === option.id
              return (
                <label
                  key={option.id}
                  className={`${styles.option} ${
                    selected ? styles.optionSelected : ''
                  }`}
                >
                  <input
                    className={styles.optionInput}
                    type="radio"
                    name={`pregunta-${question.id}`}
                    checked={selected}
                    onChange={() => selectOption(question, option.id)}
                  />
                  <span className={styles.optionMarker}>
                    {question.tipo === 'VERDADERO_FALSO' ? '' : LETTERS[idx]}
                  </span>
                  <span className={styles.optionText}>{option.texto}</span>
                </label>
              )
            })}
          </div>
        ) : (
          <textarea
            className={styles.shortAnswer}
            placeholder="Escribe tu respuesta aquí…"
            value={answers[question.id]?.respuestaTexto ?? ''}
            onChange={(e) => setTexto(question, e.target.value)}
            onBlur={() => guardarTexto(question)}
          />
        )}
      </div>

      {saveError && <div className={styles.saveError}>{saveError}</div>}

      <div className={styles.nav}>
        <Button variant="ghost" onClick={goPrev} disabled={current === 0}>
          ← Anterior
        </Button>

        <div className={styles.dots}>
          {questions.map((q, idx) => {
            const answered = tieneRespuesta(answers[q.id], q.tipo)
            return (
              <button
                key={q.id}
                type="button"
                className={`${styles.dot} ${answered ? styles.dotAnswered : ''} ${
                  idx === current ? styles.dotActive : ''
                }`}
                onClick={() => setCurrent(idx)}
                aria-label={`Ir a la pregunta ${idx + 1}`}
              />
            )
          })}
        </div>

        {isLast ? (
          <Button variant="primary" onClick={() => setConfirmOpen(true)}>
            Finalizar evaluación
          </Button>
        ) : (
          <Button variant="primary" onClick={goNext}>
            Siguiente →
          </Button>
        )}
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => (submitting ? null : setConfirmOpen(false))}
        title="¿Finalizar evaluación?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Seguir revisando
            </Button>
            <Button variant="primary" onClick={handleFinish} disabled={submitting}>
              {submitting ? 'Enviando…' : 'Sí, enviar respuestas'}
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Una vez enviada, no podrás modificar tus respuestas. Revisa tu
          progreso antes de continuar.
        </p>
        <div className={styles.confirmStat}>
          <span>Preguntas respondidas</span>
          <span>
            {answeredCount} / {questions.length}
          </span>
        </div>
        <div className={styles.confirmStat}>
          <span>Sin responder</span>
          <span>{questions.length - answeredCount}</span>
        </div>
        {answeredCount < questions.length && (
          <p className={styles.warn}>
            Tienes {questions.length - answeredCount} pregunta(s) sin responder.
            Se contarán como incorrectas.
          </p>
        )}
        {saveError && <div className={styles.saveError}>{saveError}</div>}
      </Modal>
    </>
  )
}

export default EstudianteEvaluacion
