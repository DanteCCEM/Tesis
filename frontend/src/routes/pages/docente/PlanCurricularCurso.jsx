import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Modal, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import planCurricularService from '../../../services/planCurricularService.js'
import styles from './PlanCurricularCurso.module.css'

const PERIODOS = [
  { value: 'SEMESTRE', label: 'Semestre' },
  { value: 'TRIMESTRE', label: 'Trimestre' },
  { value: 'BIMESTRE', label: 'Bimestre' },
]

const ESTADOS_TEMA = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'COMPLETADO', label: 'Completado' },
]

const MAX_PDF_MB = 10
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024

const uid = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatPeriodo(valor) {
  return PERIODOS.find((p) => p.value === valor)?.label ?? valor
}

function cloneEstructura(unidades = []) {
  return unidades.map((unidad) => ({
    ...unidad,
    _key: unidad.id ?? unidad._key ?? uid(),
    temas: (unidad.temas ?? []).map((tema) => ({
      ...tema,
      _key: tema.id ?? tema._key ?? uid(),
      subtemas: (tema.subtemas ?? []).map((subtema) => ({
        ...subtema,
        _key: subtema.id ?? subtema._key ?? uid(),
      })),
    })),
  }))
}

function mapUnidadesParaApi(unidades) {
  return unidades.map((unidad, uIndex) => ({
    titulo: String(unidad.titulo ?? '').trim(),
    descripcion: unidad.descripcion ? String(unidad.descripcion).trim() : null,
    orden: uIndex + 1,
    temas: (unidad.temas ?? []).map((tema, tIndex) => ({
      titulo: String(tema.titulo ?? '').trim(),
      descripcion: tema.descripcion ? String(tema.descripcion).trim() : null,
      orden: tIndex + 1,
      estado: tema.estado ?? 'PENDIENTE',
      subtemas: (tema.subtemas ?? []).map((subtema, sIndex) => ({
        titulo: String(subtema.titulo ?? '').trim(),
        descripcion: subtema.descripcion ? String(subtema.descripcion).trim() : null,
        orden: sIndex + 1,
      })),
    })),
  }))
}

function isSinClasificar(titulo) {
  return String(titulo ?? '')
    .trim()
    .toLowerCase()
    .includes('sin clasificar')
}

function moveItem(list, index, direction) {
  const next = [...list]
  const target = index + direction
  if (target < 0 || target >= next.length) return list
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function PlanCurricularCurso() {
  const { cursoId: cursoIdParam } = useParams()
  const cursoId = Number(cursoIdParam)
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [curso, setCurso] = useState(null)
  const [planes, setPlanes] = useState([])
  const [planActivo, setPlanActivo] = useState(null)
  const [estructura, setEstructura] = useState([])
  const [openUnits, setOpenUnits] = useState({})

  const [loading, setLoading] = useState(true)
  const [loadingPlanes, setLoadingPlanes] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [info, setInfo] = useState('')

  const [periodo, setPeriodo] = useState('SEMESTRE')
  const [archivo, setArchivo] = useState(null)
  const [uploadErrors, setUploadErrors] = useState({})
  const [subiendo, setSubiendo] = useState(false)

  const [procesando, setProcesando] = useState(false)
  const [confirmProcesarOpen, setConfirmProcesarOpen] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [confirmPublicarOpen, setConfirmPublicarOpen] = useState(false)

  const limpiarMensajes = () => {
    setError('')
    setSuccess('')
    setInfo('')
  }

  const aplicarPlan = useCallback((plan) => {
    setPlanActivo(plan)
    setEstructura(cloneEstructura(plan?.unidades ?? []))
    setOpenUnits({})
  }, [])

  const cargarDatos = useCallback(async () => {
    if (!Number.isInteger(cursoId) || cursoId <= 0) {
      setError('Identificador de curso inválido.')
      setLoading(false)
      setLoadingPlanes(false)
      return
    }

    limpiarMensajes()
    setLoading(true)
    setLoadingPlanes(true)

    try {
      const [cursoData, planesData] = await Promise.all([
        cursosService.detalle(cursoId),
        planCurricularService.listarPorCurso(cursoId),
      ])
      setCurso(cursoData)
      setPlanes(planesData)
      if (planesData.length > 0) {
        aplicarPlan(planesData[0])
      } else {
        setPlanActivo(null)
        setEstructura([])
      }
    } catch (err) {
      setError(err.mensaje || 'No se pudo cargar la planificación curricular.')
    } finally {
      setLoading(false)
      setLoadingPlanes(false)
    }
  }, [aplicarPlan, cursoId])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const validarArchivo = (file) => {
    const errores = {}
    if (!file) {
      errores.archivo = 'Selecciona un archivo PDF.'
      return errores
    }
    if (file.type !== 'application/pdf') {
      errores.archivo = 'Solo se permiten archivos PDF.'
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      errores.archivo = 'El archivo debe tener extensión .pdf.'
    }
    if (file.size > MAX_PDF_BYTES) {
      errores.archivo = `El PDF no puede superar ${MAX_PDF_MB} MB.`
    }
    return errores
  }

  const handleArchivoChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setArchivo(file)
    setUploadErrors(validarArchivo(file))
    limpiarMensajes()
  }

  const handleSubirPlan = async () => {
    const errores = validarArchivo(archivo)
    if (Object.keys(errores).length > 0) {
      setUploadErrors(errores)
      return
    }

    limpiarMensajes()
    setSubiendo(true)

    try {
      const plan = await planCurricularService.subirPlan(cursoId, {
        periodo,
        archivo,
      })
      setPlanes((prev) => [plan, ...prev.filter((p) => p.id !== plan.id)])
      aplicarPlan(plan)
      setArchivo(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess('Plan curricular subido correctamente. Puedes analizarlo con IA.')
    } catch (err) {
      setError(err.mensaje || 'No se pudo subir el plan curricular.')
    } finally {
      setSubiendo(false)
    }
  }

  const ejecutarProcesarPdf = async (confirmarReemplazo = false) => {
    if (!planActivo) return

    limpiarMensajes()
    setProcesando(true)
    setConfirmProcesarOpen(false)

    try {
      const resultado = await planCurricularService.procesarPdf(planActivo.id, {
        confirmarReemplazo,
      })
      const plan = resultado.plan
      setPlanes((prev) =>
        prev.map((p) => (p.id === plan.id ? plan : p)),
      )
      aplicarPlan(plan)
      setInfo(
        resultado.meta?.mensaje ||
          'Estructura generada en borrador. Revísala antes de publicar.',
      )
      if (resultado.meta?.textoTruncado) {
        setInfo(
          'El PDF era muy extenso; se procesó una parte. Revisa la estructura generada.',
        )
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setConfirmProcesarOpen(true)
        setInfo(
          'Ya existe una estructura. Confirma si deseas reemplazarla con el análisis del PDF.',
        )
      } else {
        setError(err.mensaje || 'No se pudo procesar el PDF con IA.')
      }
    } finally {
      setProcesando(false)
    }
  }

  const handleGuardarBorrador = async () => {
    if (!planActivo) return

    for (const unidad of estructura) {
      if (!String(unidad.titulo ?? '').trim()) {
        setError('Todas las unidades deben tener título.')
        return
      }
    }

    limpiarMensajes()
    setGuardando(true)

    try {
      const plan = await planCurricularService.actualizarPlan(planActivo.id, {
        periodo: planActivo.periodo,
        estado: 'BORRADOR',
        unidades: mapUnidadesParaApi(estructura),
      })
      setPlanes((prev) => prev.map((p) => (p.id === plan.id ? plan : p)))
      aplicarPlan(plan)
      setSuccess('Borrador guardado correctamente.')
    } catch (err) {
      setError(err.mensaje || 'No se pudo guardar el borrador.')
    } finally {
      setGuardando(false)
    }
  }

  const handlePublicar = async () => {
    if (!planActivo) return

    limpiarMensajes()
    setPublicando(true)
    setConfirmPublicarOpen(false)

    try {
      const plan = await planCurricularService.publicar(planActivo.id)
      setPlanes((prev) => prev.map((p) => (p.id === plan.id ? plan : p)))
      aplicarPlan(plan)
      setSuccess('Plan publicado. Los estudiantes matriculados ya pueden verlo.')
    } catch (err) {
      setError(err.mensaje || 'No se pudo publicar el plan.')
    } finally {
      setPublicando(false)
    }
  }

  const toggleUnit = (key) => {
    setOpenUnits((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const updateUnidad = (key, field, value) => {
    setEstructura((prev) =>
      prev.map((u) => (u._key === key ? { ...u, [field]: value } : u)),
    )
  }

  const updateTema = (unitKey, temaKey, field, value) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        return {
          ...u,
          temas: (u.temas ?? []).map((t) =>
            t._key === temaKey ? { ...t, [field]: value } : t,
          ),
        }
      }),
    )
  }

  const updateSubtema = (unitKey, temaKey, subtemaKey, field, value) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        return {
          ...u,
          temas: (u.temas ?? []).map((t) => {
            if (t._key !== temaKey) return t
            return {
              ...t,
              subtemas: (t.subtemas ?? []).map((s) =>
                s._key === subtemaKey ? { ...s, [field]: value } : s,
              ),
            }
          }),
        }
      }),
    )
  }

  const addUnidad = () => {
    setEstructura((prev) => [
      ...prev,
      {
        _key: uid(),
        titulo: `Unidad ${prev.length + 1}`,
        descripcion: '',
        temas: [],
      },
    ])
  }

  const removeUnidad = (key) => {
    setEstructura((prev) => prev.filter((u) => u._key !== key))
  }

  const moveUnidad = (index, direction) => {
    setEstructura((prev) => moveItem(prev, index, direction))
  }

  const addTema = (unitKey) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        const temas = u.temas ?? []
        return {
          ...u,
          temas: [
            ...temas,
            {
              _key: uid(),
              titulo: `Tema ${temas.length + 1}`,
              descripcion: '',
              estado: 'PENDIENTE',
              subtemas: [],
            },
          ],
        }
      }),
    )
  }

  const removeTema = (unitKey, temaKey) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        return {
          ...u,
          temas: (u.temas ?? []).filter((t) => t._key !== temaKey),
        }
      }),
    )
  }

  const moveTema = (unitKey, index, direction) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        return { ...u, temas: moveItem(u.temas ?? [], index, direction) }
      }),
    )
  }

  const addSubtema = (unitKey, temaKey) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        return {
          ...u,
          temas: (u.temas ?? []).map((t) => {
            if (t._key !== temaKey) return t
            const subtemas = t.subtemas ?? []
            return {
              ...t,
              subtemas: [
                ...subtemas,
                {
                  _key: uid(),
                  titulo: `Subtema ${subtemas.length + 1}`,
                  descripcion: '',
                },
              ],
            }
          }),
        }
      }),
    )
  }

  const removeSubtema = (unitKey, temaKey, subtemaKey) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        return {
          ...u,
          temas: (u.temas ?? []).map((t) => {
            if (t._key !== temaKey) return t
            return {
              ...t,
              subtemas: (t.subtemas ?? []).filter((s) => s._key !== subtemaKey),
            }
          }),
        }
      }),
    )
  }

  const moveSubtema = (unitKey, temaKey, index, direction) => {
    setEstructura((prev) =>
      prev.map((u) => {
        if (u._key !== unitKey) return u
        return {
          ...u,
          temas: (u.temas ?? []).map((t) => {
            if (t._key !== temaKey) return t
            return { ...t, subtemas: moveItem(t.subtemas ?? [], index, direction) }
          }),
        }
      }),
    )
  }

  const puedeProcesarIA = Boolean(planActivo?.id && planActivo?.nombreArchivo)

  const tituloPagina = useMemo(
    () => curso?.nombre ?? 'Plan curricular',
    [curso?.nombre],
  )

  if (!Number.isInteger(cursoId) || cursoId <= 0) {
    return (
      <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>Curso no válido</h2>
        <Button variant="outline" onClick={() => navigate('/docente/cursos')}>
          Volver a mis cursos
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.loadingBox}>
        <span className={styles.spinner} aria-hidden="true" />
        Cargando plan curricular…
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Panel docente"
        title={tituloPagina}
        subtitle="Sube, analiza y organiza la planificación curricular del curso."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                navigate(
                  `/docente/plan-curricular?curso=${cursoId}&periodo=${planActivo?.periodo ?? periodo}`,
                )
              }
            >
              ← Plan curricular
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(`/docente/cursos/${cursoId}`)}
            >
              Detalle del curso
            </Button>
            <Button variant="outline" onClick={() => navigate('/docente/cursos')}>
              Mis cursos
            </Button>
          </>
        }
      />

      {error && (
        <div className={styles.feedbackError} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.feedbackSuccess} role="status">
          {success}
        </div>
      )}
      {info && (
        <div className={styles.feedbackInfo} role="status">
          {info}
        </div>
      )}

      <Card title="Subir planificación curricular">
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="periodo">
              Periodo
            </label>
            <select
              id="periodo"
              className={styles.select}
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            >
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Archivo PDF</span>
            <div className={styles.filePicker}>
              <input
                ref={fileInputRef}
                id="archivo-pdf"
                type="file"
                accept="application/pdf,.pdf"
                className={styles.hiddenInput}
                onChange={handleArchivoChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Seleccionar PDF
              </Button>
              {archivo && (
                <p className={styles.fileMeta}>
                  {archivo.name} · {formatBytes(archivo.size)}
                </p>
              )}
            </div>
            {uploadErrors.archivo && (
              <span className={styles.errorText}>{uploadErrors.archivo}</span>
            )}
          </div>
        </div>

        <div className={styles.sectionActions}>
          <Button
            variant="primary"
            disabled={subiendo || !archivo}
            onClick={handleSubirPlan}
          >
            {subiendo ? 'Subiendo…' : 'Subir planificación curricular'}
          </Button>
        </div>
      </Card>

      {loadingPlanes ? (
        <div className={styles.loadingBox}>
          <span className={styles.spinner} aria-hidden="true" />
          Cargando planes…
        </div>
      ) : planes.length === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Sin plan curricular</h2>
          <p className={styles.emptyText}>
            Sube un PDF para comenzar la planificación de este curso.
          </p>
        </div>
      ) : (
        <>
          <Card title="Plan activo">
            <div className={styles.statusRow}>
              <span
                className={`${styles.badge} ${
                  planActivo?.estado === 'PUBLICADO'
                    ? styles.badgePublished
                    : styles.badgeDraft
                }`}
              >
                {planActivo?.estado === 'PUBLICADO' ? 'PUBLICADO' : 'BORRADOR'}
              </span>
              <span className={styles.fileMeta}>
                {planActivo?.nombreArchivo} · {formatPeriodo(planActivo?.periodo)}
              </span>
            </div>

            {planes.length > 1 && (
              <div className={styles.planSelector}>
                {planes.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`${styles.planChip} ${
                      plan.id === planActivo?.id ? styles.planChipActive : ''
                    }`}
                    onClick={() => aplicarPlan(plan)}
                  >
                    {plan.nombreArchivo}
                  </button>
                ))}
              </div>
            )}

            {puedeProcesarIA && (
              <div className={styles.sectionActions} style={{ marginTop: '16px' }}>
                <Button
                  variant="secondary"
                  disabled={procesando}
                  onClick={() => ejecutarProcesarPdf(false)}
                >
                  {procesando ? 'Analizando con IA…' : 'Analizar temas con IA'}
                </Button>
              </div>
            )}

            {procesando && (
              <div className={styles.loadingBox}>
                <span className={styles.spinner} aria-hidden="true" />
                Procesando PDF con IA. La estructura quedará en borrador para tu
                revisión…
              </div>
            )}

            {!procesando && puedeProcesarIA && (
              <p className={styles.fileMeta} style={{ marginTop: '12px' }}>
                La IA generará un borrador editable. Debes revisarlo antes de
                publicarlo a los estudiantes.
              </p>
            )}
          </Card>

          <Card title="Estructura curricular">
            {estructura.length === 0 ? (
              <div className={styles.emptyState}>
                <h2 className={styles.emptyTitle}>Estructura vacía</h2>
                <p className={styles.emptyText}>
                  Analiza el PDF con IA o agrega unidades manualmente.
                </p>
                <Button variant="outline" onClick={addUnidad}>
                  Agregar unidad
                </Button>
              </div>
            ) : (
              <>
                <div className={styles.accordion}>
                  {estructura.map((unidad, uIndex) => {
                    const open = Boolean(openUnits[unidad._key])
                    return (
                      <div key={unidad._key} className={styles.unitCard}>
                        <button
                          type="button"
                          className={`${styles.unitHeader} ${
                            open ? styles.unitHeaderOpen : ''
                          }`}
                          onClick={() => toggleUnit(unidad._key)}
                          aria-expanded={open}
                        >
                          <div>
                            <h3 className={styles.unitTitle}>
                              {unidad.titulo || `Unidad ${uIndex + 1}`}
                            </h3>
                            <p className={styles.unitMeta}>
                              {(unidad.temas ?? []).length} tema(s)
                            </p>
                          </div>
                          <svg
                            className={`${styles.chevron} ${
                              open ? styles.chevronOpen : ''
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>

                        {open && (
                          <div className={styles.unitBody}>
                            <div className={styles.inlineFields}>
                              <div className={styles.field}>
                                <label className={styles.label}>Título</label>
                                <input
                                  className={styles.input}
                                  value={unidad.titulo ?? ''}
                                  onChange={(e) =>
                                    updateUnidad(unidad._key, 'titulo', e.target.value)
                                  }
                                />
                              </div>
                              <div className={styles.field}>
                                <label className={styles.label}>Descripción</label>
                                <input
                                  className={styles.input}
                                  value={unidad.descripcion ?? ''}
                                  onChange={(e) =>
                                    updateUnidad(
                                      unidad._key,
                                      'descripcion',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className={styles.unitActions}>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={uIndex === 0}
                                onClick={() => moveUnidad(uIndex, -1)}
                              >
                                ↑ Unidad
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={uIndex === estructura.length - 1}
                                onClick={() => moveUnidad(uIndex, 1)}
                              >
                                ↓ Unidad
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addTema(unidad._key)}
                              >
                                + Tema
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeUnidad(unidad._key)}
                              >
                                Eliminar unidad
                              </Button>
                            </div>

                            {(unidad.temas ?? []).map((tema, tIndex) => (
                              <div key={tema._key} className={styles.topicCard}>
                                <div className={styles.topicHeader}>
                                  <h4
                                    className={`${styles.topicTitle} ${
                                      isSinClasificar(tema.titulo)
                                        ? styles.ambiguous
                                        : ''
                                    }`}
                                  >
                                    {tema.titulo || `Tema ${tIndex + 1}`}
                                  </h4>
                                  <div className={styles.rowActions}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={tIndex === 0}
                                      onClick={() =>
                                        moveTema(unidad._key, tIndex, -1)
                                      }
                                    >
                                      ↑
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={
                                        tIndex === (unidad.temas?.length ?? 0) - 1
                                      }
                                      onClick={() =>
                                        moveTema(unidad._key, tIndex, 1)
                                      }
                                    >
                                      ↓
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        removeTema(unidad._key, tema._key)
                                      }
                                    >
                                      Eliminar
                                    </Button>
                                  </div>
                                </div>

                                <div className={styles.inlineFields}>
                                  <div className={styles.field}>
                                    <label className={styles.label}>Título</label>
                                    <input
                                      className={styles.input}
                                      value={tema.titulo ?? ''}
                                      onChange={(e) =>
                                        updateTema(
                                          unidad._key,
                                          tema._key,
                                          'titulo',
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label className={styles.label}>Estado</label>
                                    <select
                                      className={styles.select}
                                      value={tema.estado ?? 'PENDIENTE'}
                                      onChange={(e) =>
                                        updateTema(
                                          unidad._key,
                                          tema._key,
                                          'estado',
                                          e.target.value,
                                        )
                                      }
                                    >
                                      {ESTADOS_TEMA.map((e) => (
                                        <option key={e.value} value={e.value}>
                                          {e.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className={styles.field}>
                                  <label className={styles.label}>Descripción</label>
                                  <textarea
                                    className={styles.textarea}
                                    value={tema.descripcion ?? ''}
                                    onChange={(e) =>
                                      updateTema(
                                        unidad._key,
                                        tema._key,
                                        'descripcion',
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>

                                <div className={styles.rowActions}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addSubtema(unidad._key, tema._key)}
                                  >
                                    + Subtema
                                  </Button>
                                </div>

                                <div className={styles.subtopicList}>
                                  {(tema.subtemas ?? []).map((subtema, sIndex) => (
                                    <div
                                      key={subtema._key}
                                      className={styles.subtopicItem}
                                    >
                                      <div>
                                        <div className={styles.field}>
                                          <label className={styles.label}>
                                            Subtema
                                          </label>
                                          <input
                                            className={`${styles.input} ${
                                              isSinClasificar(subtema.titulo)
                                                ? styles.ambiguous
                                                : ''
                                            }`}
                                            value={subtema.titulo ?? ''}
                                            onChange={(e) =>
                                              updateSubtema(
                                                unidad._key,
                                                tema._key,
                                                subtema._key,
                                                'titulo',
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                        <div className={styles.field}>
                                          <label className={styles.label}>
                                            Descripción
                                          </label>
                                          <input
                                            className={styles.input}
                                            value={subtema.descripcion ?? ''}
                                            onChange={(e) =>
                                              updateSubtema(
                                                unidad._key,
                                                tema._key,
                                                subtema._key,
                                                'descripcion',
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className={styles.rowActions}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={sIndex === 0}
                                          onClick={() =>
                                            moveSubtema(
                                              unidad._key,
                                              tema._key,
                                              sIndex,
                                              -1,
                                            )
                                          }
                                        >
                                          ↑
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={
                                            sIndex ===
                                            (tema.subtemas?.length ?? 0) - 1
                                          }
                                          onClick={() =>
                                            moveSubtema(
                                              unidad._key,
                                              tema._key,
                                              sIndex,
                                              1,
                                            )
                                          }
                                        >
                                          ↓
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            removeSubtema(
                                              unidad._key,
                                              tema._key,
                                              subtema._key,
                                            )
                                          }
                                        >
                                          ✕
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className={styles.sectionActions}>
                  <Button variant="outline" onClick={addUnidad}>
                    Agregar unidad
                  </Button>
                  <Button
                    variant="primary"
                    disabled={guardando}
                    onClick={handleGuardarBorrador}
                  >
                    {guardando ? 'Guardando…' : 'Guardar borrador'}
                  </Button>
                  {planActivo?.estado !== 'PUBLICADO' && (
                    <Button
                      variant="secondary"
                      disabled={publicando || estructura.length === 0}
                      onClick={() => setConfirmPublicarOpen(true)}
                    >
                      Publicar plan para estudiantes
                    </Button>
                  )}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <Modal
        isOpen={confirmProcesarOpen}
        title="Reemplazar estructura"
        onClose={() => setConfirmProcesarOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmProcesarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={procesando}
              onClick={() => ejecutarProcesarPdf(true)}
            >
              Reemplazar con IA
            </Button>
          </>
        }
      >
        <p>
          Este plan ya tiene una estructura curricular. Si continúas, se
          reemplazará por el borrador generado desde el PDF. ¿Deseas continuar?
        </p>
      </Modal>

      <Modal
        isOpen={confirmPublicarOpen}
        title="Publicar plan curricular"
        onClose={() => setConfirmPublicarOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmPublicarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={publicando}
              onClick={handlePublicar}
            >
              {publicando ? 'Publicando…' : 'Confirmar publicación'}
            </Button>
          </>
        }
      >
        <p>
          Los estudiantes matriculados podrán ver este plan. Asegúrate de haber
          revisado unidades, temas y subtemas antes de publicar.
        </p>
      </Modal>
    </div>
  )
}

export default PlanCurricularCurso
