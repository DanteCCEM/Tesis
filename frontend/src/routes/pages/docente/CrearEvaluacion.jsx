import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import evaluacionesService from '../../../services/evaluacionesService.js'
import iaService from '../../../services/iaService.js'
import styles from './CrearEvaluacion.module.css'

const DIFFICULTIES = [
  { value: 'BASICO', label: 'Básico' },
  { value: 'INTERMEDIO', label: 'Intermedio' },
  { value: 'AVANZADO', label: 'Avanzado' },
]

const QUESTION_TYPES = [
  { value: 'multiple', label: 'Opción múltiple', backend: 'OPCION_MULTIPLE' },
  { value: 'truefalse', label: 'Verdadero / Falso', backend: 'VERDADERO_FALSO' },
  { value: 'short', label: 'Respuesta corta', backend: 'RESPUESTA_CORTA' },
]

const BACKEND_TYPES = QUESTION_TYPES.map((t) => t.backend)

const EMPTY_FORM = {
  course: '',
  title: '',
  topic: '',
  subtopic: '',
  difficulty: 'INTERMEDIO',
  amount: 5,
  tiposPregunta: ['OPCION_MULTIPLE'],
  type: 'multiple',
  deadline: '',
}

let optionSeq = 0
const nextId = () => `${Date.now()}-${optionSeq++}`

const frontendTypeFromBackend = (tipo) => {
  if (tipo === 'VERDADERO_FALSO') return 'truefalse'
  if (tipo === 'RESPUESTA_CORTA') return 'short'
  return 'multiple'
}

function makeOptions(texts) {
  return texts.map((text) => ({ id: nextId(), text }))
}

function makeBlankQuestion(type, { difficulty = 'INTERMEDIO', puntaje = 1 } = {}) {
  if (type === 'truefalse') {
    const options = makeOptions(['Verdadero', 'Falso'])
    return {
      id: nextId(),
      type,
      text: '',
      options,
      correctId: options[0].id,
      answer: '',
      difficulty,
      puntaje,
      explicacion: '',
    }
  }
  if (type === 'short') {
    return {
      id: nextId(),
      type,
      text: '',
      options: [],
      correctId: null,
      answer: '',
      difficulty,
      puntaje,
      explicacion: '',
    }
  }
  const options = makeOptions(['', '', '', ''])
  return {
    id: nextId(),
    type,
    text: '',
    options,
    correctId: options[0].id,
    answer: '',
    difficulty,
    puntaje,
    explicacion: '',
  }
}

function mapAiQuestionToEditor(pregunta) {
  const type = frontendTypeFromBackend(pregunta.tipo)

  if (type === 'short') {
    return {
      id: nextId(),
      type,
      text: pregunta.enunciado,
      options: [],
      correctId: null,
      answer: pregunta.respuestaCorrecta ?? '',
      difficulty: pregunta.dificultad,
      puntaje: pregunta.puntaje ?? 1,
      explicacion: pregunta.explicacion ?? '',
      generatedByIA: true,
    }
  }

  const options = (pregunta.alternativas ?? []).map((alt) => ({
    id: nextId(),
    text: alt.texto,
    esCorrecta: alt.esCorrecta === true,
  }))

  const correctOption =
    options.find((opt) => opt.esCorrecta) ||
    options.find(
      (opt) =>
        opt.text.trim().toLowerCase() ===
        String(pregunta.respuestaCorrecta ?? '')
          .trim()
          .toLowerCase(),
    ) ||
    options[0]

  return {
    id: nextId(),
    type,
    text: pregunta.enunciado,
    options: options.map(({ id, text }) => ({ id, text })),
    correctId: correctOption?.id ?? null,
    answer: '',
    difficulty: pregunta.dificultad,
    puntaje: pregunta.puntaje ?? 1,
    explicacion: pregunta.explicacion ?? '',
    generatedByIA: true,
  }
}

function validateQuestions(questions, { requireAtLeastOne }) {
  if (requireAtLeastOne && questions.length === 0) {
    return 'Agrega al menos una pregunta antes de publicar.'
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.text.trim()) {
      return `La pregunta ${i + 1} no tiene enunciado.`
    }
    const puntaje = Number(q.puntaje)
    if (!puntaje || puntaje <= 0) {
      return `La pregunta ${i + 1} requiere un puntaje válido (mayor a 0).`
    }
    if (!DIFFICULTIES.some((d) => d.value === q.difficulty)) {
      return `La pregunta ${i + 1} requiere un nivel de dificultad válido.`
    }
    if (q.type === 'short') {
      if (!q.answer.trim()) {
        return `La pregunta ${i + 1} requiere una respuesta correcta.`
      }
    } else {
      const conTexto = q.options.filter((o) => o.text.trim())
      if (conTexto.length < 2) {
        return `La pregunta ${i + 1} requiere al menos 2 alternativas con texto.`
      }
      const correcta = q.options.find((o) => o.id === q.correctId)
      if (!correcta || !correcta.text.trim()) {
        return `Marca la alternativa correcta en la pregunta ${i + 1}.`
      }
    }
  }
  return ''
}

function buildQuestionPayload(q, { tema, dificultadDefault }) {
  const base = {
    enunciado: q.text.trim(),
    tema,
    dificultad: q.difficulty || dificultadDefault,
    puntaje: Number(q.puntaje) || 1,
  }

  if (q.type === 'short') {
    return { ...base, tipo: 'RESPUESTA_CORTA', respuestaCorrecta: q.answer.trim() }
  }
  if (q.type === 'truefalse') {
    const correcta = q.options.find((o) => o.id === q.correctId)
    const esVerdadero = (correcta?.text || '').trim().toLowerCase().startsWith('v')
    return {
      ...base,
      tipo: 'VERDADERO_FALSO',
      respuestaCorrecta: esVerdadero ? 'verdadero' : 'falso',
    }
  }
  const alternativas = q.options
    .filter((o) => o.text.trim())
    .map((o) => ({ texto: o.text.trim(), esCorrecta: o.id === q.correctId }))
  return { ...base, tipo: 'OPCION_MULTIPLE', alternativas }
}

function CrearEvaluacion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cursoIdParam = searchParams.get('cursoId')

  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [coursesError, setCoursesError] = useState('')

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [questions, setQuestions] = useState([])
  const [banner, setBanner] = useState('')
  const [bannerError, setBannerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generatingIA, setGeneratingIA] = useState(false)

  useEffect(() => {
    let cancelado = false
    cursosService
      .misCursos()
      .then((data) => {
        if (!cancelado) {
          setCourses(data)
          setCoursesError('')
          if (cursoIdParam && data.some((c) => String(c.id) === cursoIdParam)) {
            setForm((prev) => ({ ...prev, course: cursoIdParam }))
          }
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setCoursesError(err.mensaje || 'No se pudieron cargar tus cursos.')
        }
      })
      .finally(() => {
        if (!cancelado) setLoadingCourses(false)
      })
    return () => {
      cancelado = true
    }
  }, [cursoIdParam])

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const toggleTipoPregunta = (backendType) => {
    setForm((prev) => {
      const selected = prev.tiposPregunta.includes(backendType)
        ? prev.tiposPregunta.filter((t) => t !== backendType)
        : [...prev.tiposPregunta, backendType]
      return { ...prev, tiposPregunta: selected }
    })
    setErrors((prev) => ({ ...prev, tiposPregunta: undefined }))
  }

  const validateForm = () => {
    const next = {}
    if (!form.course) next.course = 'Selecciona un curso.'
    if (!form.title.trim()) next.title = 'El título es obligatorio.'
    if (!form.topic.trim()) next.topic = 'El tema principal es obligatorio.'
    const amount = Number(form.amount)
    if (!amount || amount < 1) next.amount = 'Indica una cantidad válida (mínimo 1).'
    if (amount > 20) next.amount = 'El máximo permitido es 20 preguntas.'
    return next
  }

  const validateFormForIA = () => {
    const next = validateForm()
    if (!form.subtopic.trim()) next.subtopic = 'El subtema es obligatorio para generar con IA.'
    if (form.tiposPregunta.length === 0) {
      next.tiposPregunta = 'Selecciona al menos un tipo de pregunta.'
    }
    return next
  }

  const handleGenerateWithIA = async () => {
    const next = validateFormForIA()
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    if (questions.length > 0) {
      const confirmar = window.confirm(
        'Ya tienes preguntas en el borrador. ¿Deseas reemplazarlas con las generadas por IA?',
      )
      if (!confirmar) return
    }

    const curso = courses.find((c) => String(c.id) === String(form.course))
    if (!curso) {
      setErrors({ course: 'Selecciona un curso válido.' })
      return
    }

    setErrors({})
    setBanner('')
    setBannerError('')
    setGeneratingIA(true)

    try {
      const respuesta = await iaService.generarPreguntas({
        curso: curso.nombre,
        grado: curso.grado,
        tema: form.topic.trim(),
        subtema: form.subtopic.trim(),
        dificultad: form.difficulty,
        cantidadPreguntas: Number(form.amount),
        tiposPregunta: form.tiposPregunta,
      })

      const generadas = (respuesta.preguntas ?? []).map(mapAiQuestionToEditor)
      if (generadas.length === 0) {
        setBannerError('La IA no devolvió preguntas. Intenta de nuevo.')
        return
      }

      setQuestions(generadas)
      setBanner(
        `Se generaron ${generadas.length} pregunta(s) con IA. Revísalas, edítalas y confirma al guardar o publicar.`,
      )
    } catch (err) {
      setBannerError(err.mensaje || 'No se pudo generar el borrador con IA.')
    } finally {
      setGeneratingIA(false)
    }
  }

  const updateQuestion = (id, patch) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  const updateOption = (questionId, optionId, text) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((o) =>
                o.id === optionId ? { ...o, text } : o,
              ),
            }
          : q,
      ),
    )
  }

  const addOption = (questionId) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: [...q.options, { id: nextId(), text: '' }] }
          : q,
      ),
    )
  }

  const removeOption = (questionId, optionId) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q
        if (q.options.length <= 2) return q
        const options = q.options.filter((o) => o.id !== optionId)
        const correctId = q.correctId === optionId ? options[0].id : q.correctId
        return { ...q, options, correctId }
      }),
    )
  }

  const removeQuestion = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const addQuestion = () => {
    const defaultType = frontendTypeFromBackend(form.tiposPregunta[0] ?? 'OPCION_MULTIPLE')
    setQuestions((prev) => [
      ...prev,
      makeBlankQuestion(form.type || defaultType, { difficulty: form.difficulty }),
    ])
  }

  const guardar = async (publicar) => {
    const formErrors = validateForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    if (publicar || questions.length > 0) {
      const qError = validateQuestions(questions, { requireAtLeastOne: publicar })
      if (qError) {
        setBannerError(qError)
        return
      }
    }

    setSubmitting(true)
    setBanner('')
    setBannerError('')

    try {
      const dificultad = form.difficulty
      const tema = form.topic.trim()

      const evaluacion = await evaluacionesService.crear({
        cursoId: Number(form.course),
        titulo: form.title.trim(),
        tema,
        subtema: form.subtopic.trim() || undefined,
        dificultad,
        fechaLimite: form.deadline || undefined,
        estado: 'BORRADOR',
      })

      for (const q of questions) {
        await evaluacionesService.agregarPregunta(
          evaluacion.id,
          buildQuestionPayload(q, { tema, dificultadDefault: dificultad }),
        )
      }

      if (publicar) {
        await evaluacionesService.publicar(evaluacion.id)
      }

      setBanner(
        publicar
          ? `Evaluación "${form.title.trim()}" publicada con ${questions.length} pregunta(s).`
          : `Borrador "${form.title.trim()}" guardado correctamente.`,
      )
      setForm(EMPTY_FORM)
      setQuestions([])
      setErrors({})
    } catch (err) {
      setBannerError(err.mensaje || 'No se pudo guardar la evaluación.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Panel docente"
        title="Crear evaluación"
        subtitle="Configura los parámetros, genera un borrador con IA y revisa cada pregunta antes de publicar."
        actions={
          <Button variant="ghost" onClick={() => navigate('/docente/cursos')}>
            ← Volver a mis cursos
          </Button>
        }
      />

      {banner && (
        <div className={styles.banner} role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>{banner}</span>
        </div>
      )}

      {bannerError && (
        <div className={styles.bannerError} role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <span>{bannerError}</span>
        </div>
      )}

      <Card title="Configuración de la evaluación">
        {loadingCourses ? (
          <div className={styles.state}>
            <span className={styles.spinner} aria-hidden="true" />
            <p>Cargando tus cursos…</p>
          </div>
        ) : coursesError ? (
          <div className={styles.state}>
            <p>{coursesError}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className={styles.state}>
            <p>Aún no tienes cursos. Crea un curso antes de añadir evaluaciones.</p>
            <Button variant="primary" size="sm" onClick={() => navigate('/docente/cursos')}>
              Ir a mis cursos
            </Button>
          </div>
        ) : (
          <div className={styles.form}>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="course">
                  Curso
                </label>
                <select
                  id="course"
                  className={`${styles.select} ${errors.course ? styles.inputError : ''}`}
                  value={form.course}
                  onChange={handleChange('course')}
                  disabled={generatingIA}
                >
                  <option value="">Selecciona un curso…</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.nombre} — {course.grado}
                    </option>
                  ))}
                </select>
                {errors.course && <span className={styles.errorText}>{errors.course}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="title">
                  Título de la evaluación
                </label>
                <input
                  id="title"
                  type="text"
                  className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                  placeholder="Ej. Examen parcial de Álgebra"
                  value={form.title}
                  onChange={handleChange('title')}
                  disabled={generatingIA}
                />
                {errors.title && <span className={styles.errorText}>{errors.title}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="topic">
                  Tema principal
                </label>
                <input
                  id="topic"
                  type="text"
                  className={`${styles.input} ${errors.topic ? styles.inputError : ''}`}
                  placeholder="Ej. Ecuaciones cuadráticas"
                  value={form.topic}
                  onChange={handleChange('topic')}
                  disabled={generatingIA}
                />
                {errors.topic && <span className={styles.errorText}>{errors.topic}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="subtopic">
                  Subtema
                </label>
                <input
                  id="subtopic"
                  type="text"
                  className={`${styles.input} ${errors.subtopic ? styles.inputError : ''}`}
                  placeholder="Ej. Fórmula general"
                  value={form.subtopic}
                  onChange={handleChange('subtopic')}
                  disabled={generatingIA}
                />
                {errors.subtopic && <span className={styles.errorText}>{errors.subtopic}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="difficulty">
                  Nivel de dificultad
                </label>
                <select
                  id="difficulty"
                  className={styles.select}
                  value={form.difficulty}
                  onChange={handleChange('difficulty')}
                  disabled={generatingIA}
                >
                  {DIFFICULTIES.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="amount">
                  Cantidad de preguntas
                </label>
                <input
                  id="amount"
                  type="number"
                  min="1"
                  max="20"
                  className={`${styles.input} ${errors.amount ? styles.inputError : ''}`}
                  value={form.amount}
                  onChange={handleChange('amount')}
                  disabled={generatingIA}
                />
                {errors.amount && <span className={styles.errorText}>{errors.amount}</span>}
              </div>

              <div className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.label}>Tipos de preguntas para IA</span>
                <div className={styles.typeChecks}>
                  {BACKEND_TYPES.map((backendType) => {
                    const meta = QUESTION_TYPES.find((t) => t.backend === backendType)
                    const checked = form.tiposPregunta.includes(backendType)
                    return (
                      <label key={backendType} className={styles.typeCheck}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTipoPregunta(backendType)}
                          disabled={generatingIA}
                        />
                        <span>{meta?.label ?? backendType}</span>
                      </label>
                    )
                  })}
                </div>
                {errors.tiposPregunta && (
                  <span className={styles.errorText}>{errors.tiposPregunta}</span>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="manualType">
                  Tipo por defecto (preguntas manuales)
                </label>
                <select
                  id="manualType"
                  className={styles.select}
                  value={form.type}
                  onChange={handleChange('type')}
                  disabled={generatingIA}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="deadline">
                  Fecha límite
                </label>
                <input
                  id="deadline"
                  type="date"
                  className={styles.input}
                  value={form.deadline}
                  onChange={handleChange('deadline')}
                  disabled={generatingIA}
                />
              </div>
            </div>

            <div className={styles.draftActions}>
              <Button
                variant="secondary"
                onClick={handleGenerateWithIA}
                disabled={generatingIA || submitting}
              >
                {generatingIA ? 'Generando borrador…' : 'Generar borrador con IA'}
              </Button>
              {generatingIA && (
                <div className={styles.generatingHint} role="status">
                  <span className={styles.spinner} aria-hidden="true" />
                  <span>La IA está redactando las preguntas. Esto puede tardar unos segundos.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className={styles.sectionTitle}>
        <h2>Preguntas</h2>
        {questions.length > 0 && (
          <span className={styles.count}>{questions.length} pregunta(s)</span>
        )}
      </div>

      {generatingIA ? (
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p>Generando preguntas con inteligencia artificial…</p>
        </div>
      ) : questions.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Aún no hay preguntas.</p>
          <p>
            Completa la configuración y pulsa <strong>Generar borrador con IA</strong> o
            añade preguntas manualmente.
          </p>
        </div>
      ) : (
        <div className={styles.questionList}>
          {questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              index={index}
              question={question}
              onUpdate={updateQuestion}
              onUpdateOption={updateOption}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onRemove={removeQuestion}
            />
          ))}
        </div>
      )}

      {courses.length > 0 && !generatingIA && (
        <Button variant="outline" onClick={addQuestion} style={{ marginTop: '16px' }}>
          + Añadir pregunta manualmente
        </Button>
      )}

      <div className={styles.footerBar}>
        <Button
          variant="ghost"
          onClick={() => guardar(false)}
          disabled={submitting || generatingIA || courses.length === 0}
        >
          {submitting ? 'Guardando…' : 'Guardar como borrador'}
        </Button>
        <Button
          variant="primary"
          onClick={() => guardar(true)}
          disabled={submitting || generatingIA || courses.length === 0}
        >
          {submitting ? 'Publicando…' : 'Publicar evaluación'}
        </Button>
      </div>
    </>
  )
}

function QuestionEditor({
  index,
  question,
  onUpdate,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onRemove,
}) {
  const typeLabel = QUESTION_TYPES.find((t) => t.value === question.type)?.label ?? ''

  return (
    <div className={styles.questionCard}>
      <div className={styles.questionHead}>
        <span className={styles.qIndex}>{index + 1}</span>
        {question.generatedByIA && (
          <span className={styles.iaTag}>Generada por IA</span>
        )}
        <select
          className={styles.qType}
          value={question.type}
          onChange={(e) => {
            const type = e.target.value
            const patch = { type }
            if (type === 'truefalse') {
              const options = makeOptions(['Verdadero', 'Falso'])
              patch.options = options
              patch.correctId = options[0].id
            } else if (type === 'short') {
              patch.options = []
              patch.correctId = null
            } else if (question.options.length < 2) {
              const options = makeOptions(['', '', '', ''])
              patch.options = options
              patch.correctId = options[0].id
            }
            onUpdate(question.id, patch)
          }}
          aria-label={`Tipo de la pregunta ${index + 1}`}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={() => onRemove(question.id)}
          aria-label={`Eliminar pregunta ${index + 1}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      <div className={styles.questionMeta}>
        <div className={styles.metaField}>
          <label className={styles.metaLabel} htmlFor={`puntaje-${question.id}`}>
            Puntaje
          </label>
          <input
            id={`puntaje-${question.id}`}
            type="number"
            min="1"
            step="1"
            className={styles.metaInput}
            value={question.puntaje}
            onChange={(e) =>
              onUpdate(question.id, { puntaje: Number(e.target.value) || 1 })
            }
          />
        </div>
        <div className={styles.metaField}>
          <label className={styles.metaLabel} htmlFor={`difficulty-${question.id}`}>
            Dificultad
          </label>
          <select
            id={`difficulty-${question.id}`}
            className={styles.metaSelect}
            value={question.difficulty}
            onChange={(e) => onUpdate(question.id, { difficulty: e.target.value })}
          >
            {DIFFICULTIES.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        className={styles.qText}
        placeholder={`Enunciado de la pregunta (${typeLabel})`}
        value={question.text}
        onChange={(e) => onUpdate(question.id, { text: e.target.value })}
      />

      {question.type === 'short' ? (
        <>
          <p className={styles.hint}>Respuesta correcta esperada:</p>
          <input
            className={styles.optionInput}
            placeholder="Escribe la respuesta correcta"
            value={question.answer}
            onChange={(e) => onUpdate(question.id, { answer: e.target.value })}
          />
        </>
      ) : (
        <>
          <p className={styles.hint}>Selecciona la alternativa correcta y edita el texto:</p>
          <div className={styles.options}>
            {question.options.map((option) => {
              const isCorrect = question.correctId === option.id
              return (
                <div className={styles.optionRow} key={option.id}>
                  <input
                    className={styles.optionRadio}
                    type="radio"
                    name={`correct-${question.id}`}
                    checked={isCorrect}
                    onChange={() => onUpdate(question.id, { correctId: option.id })}
                    aria-label="Marcar como correcta"
                  />
                  <input
                    className={`${styles.optionInput} ${isCorrect ? styles.optionInputCorrect : ''}`}
                    value={option.text}
                    placeholder="Texto de la alternativa"
                    readOnly={question.type === 'truefalse'}
                    onChange={(e) => onUpdateOption(question.id, option.id, e.target.value)}
                  />
                  {isCorrect && <span className={styles.correctTag}>✓</span>}
                  {question.type === 'multiple' && question.options.length > 2 && (
                    <button
                      type="button"
                      className={styles.optionRemove}
                      onClick={() => onRemoveOption(question.id, option.id)}
                      aria-label="Eliminar alternativa"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {question.type === 'multiple' && (
            <button
              type="button"
              className={styles.addOption}
              onClick={() => onAddOption(question.id)}
            >
              + Añadir alternativa
            </button>
          )}
        </>
      )}

      {question.explicacion && (
        <p className={styles.explicacionIA}>
          <strong>Sugerencia IA:</strong> {question.explicacion}
        </p>
      )}
    </div>
  )
}

export default CrearEvaluacion
