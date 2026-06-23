import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import progresoService from '../../../services/progresoService.js'
import practicasAdaptativasService from '../../../services/practicasAdaptativasService.js'
import styles from './Progreso.module.css'

const MAX_SCORE = 20

function getScoreColor(score) {
  if (score >= 14) return '#16a34a'
  if (score >= 11) return '#d97706'
  return '#dc2626'
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

function EstudianteProgreso() {
  const navigate = useNavigate()

  const [progreso, setProgreso] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generatingPractice, setGeneratingPractice] = useState(false)
  const [practicaError, setPracticaError] = useState('')
  const [practicaResumen, setPracticaResumen] = useState(null)
  const [practicaEvaluacionId, setPracticaEvaluacionId] = useState(null)

  const fetchProgreso = useCallback(async () => {
    try {
      const data = await progresoService.miProgreso()
      setProgreso(data)
      setError('')
    } catch (err) {
      setError(err.mensaje || 'No se pudo cargar tu progreso.')
    } finally {
      setLoading(false)
    }
  }, [])

  const reintentar = () => {
    setLoading(true)
    fetchProgreso()
  }

  const handleGenerarPractica = async () => {
    setGeneratingPractice(true)
    setPracticaError('')
    try {
      const data = await practicasAdaptativasService.generar()
      setPracticaResumen(data.resumen)
      setPracticaEvaluacionId(data.evaluacionId)
    } catch (err) {
      setPracticaError(
        err.mensaje ||
          'No se pudo generar la práctica adaptativa. Verifica que tengas evaluaciones completadas.',
      )
    } finally {
      setGeneratingPractice(false)
    }
  }

  useEffect(() => {
    let cancelado = false
    progresoService
      .miProgreso()
      .then((data) => {
        if (!cancelado) {
          setProgreso(data)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err.mensaje || 'No se pudo cargar tu progreso.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Panel estudiante" title="Mi progreso" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando tu progreso…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Panel estudiante" title="Mi progreso" />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{error}</p>
          <Button variant="outline" size="sm" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      </>
    )
  }

  const average = progreso?.promedioNota ?? 0
  const completed = progreso?.evaluacionesRealizadas ?? 0
  const levelLabel = progreso?.nivelLabel ?? 'Básico'
  const evolution = progreso?.evolucion ?? []
  const mastered = progreso?.temasDominados ?? []
  const weak = progreso?.temasPorReforzar ?? []
  const recommendations = progreso?.recomendaciones ?? []
  const history = progreso?.historial ?? []

  if (completed === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Panel estudiante"
          title="Mi progreso"
          subtitle="Revisa tu evolución, tus fortalezas y en qué debes seguir trabajando."
        />
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Todavía no hay datos de progreso</h2>
          <p className={styles.stateText}>
            Finaliza tu primera evaluación para empezar a ver tu evolución y
            recomendaciones adaptativas.
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
        eyebrow="Panel estudiante"
        title="Mi progreso"
        subtitle="Revisa tu evolución, tus fortalezas y en qué debes seguir trabajando."
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/estudiante/cursos')}
          >
            Ir a mis cursos
          </Button>
        }
      />

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </span>
          <div>
            <p className={styles.summaryValue}>{average}</p>
            <p className={styles.summaryLabel}>Promedio general (0–20)</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconAccent}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <div>
            <p className={styles.summaryValue}>{completed}</p>
            <p className={styles.summaryLabel}>Evaluaciones realizadas</p>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.summaryIconAccent}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5" />
            </svg>
          </span>
          <div>
            <p className={styles.summaryLabel} style={{ marginBottom: '6px' }}>
              Nivel actual
            </p>
            <span className={styles.levelTag}>{levelLabel}</span>
          </div>
        </div>
      </div>

      <Card
        title="Evolución de notas"
        subtitle="Tus últimas evaluaciones (escala 0–20)"
      >
        {evolution.length > 0 ? (
          <>
            <div className={styles.chart}>
              {evolution.map((point) => (
                <div className={styles.chartCol} key={point.label}>
                  <div className={styles.barWrap}>
                    <div
                      className={styles.bar}
                      style={{ height: `${(point.nota / MAX_SCORE) * 100}%` }}
                      title={point.titulo}
                    >
                      <span className={styles.barValue}>{point.nota}</span>
                    </div>
                  </div>
                  <span className={styles.barLabel}>{point.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.chartScale}>
              <span>Más antigua</span>
              <span>Más reciente</span>
            </div>
          </>
        ) : (
          <p className={styles.emptyText}>Aún no hay evaluaciones para graficar.</p>
        )}
      </Card>

      <div className={styles.columns}>
        <Card title="Temas dominados">
          {mastered.length > 0 ? (
            mastered.map((topic) => (
              <div key={topic.tema} className={styles.topicRow}>
                <span className={styles.topicName}>{topic.tema}</span>
                <span className={styles.topicBar}>
                  <span
                    className={`${styles.topicFill} ${styles.fillOk}`}
                    style={{ width: `${topic.porcentajeDominio}%` }}
                  />
                </span>
                <span className={styles.topicPct} style={{ color: '#16a34a' }}>
                  {Math.round(topic.porcentajeDominio)}%
                </span>
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>
              Aún no tienes temas dominados. ¡Sigue practicando!
            </p>
          )}
        </Card>

        <Card title="Temas por reforzar">
          {weak.length > 0 ? (
            weak.map((topic) => (
              <div key={topic.tema} className={styles.topicRow}>
                <span className={styles.topicName}>{topic.tema}</span>
                <span className={styles.topicBar}>
                  <span
                    className={`${styles.topicFill} ${styles.fillBad}`}
                    style={{ width: `${topic.porcentajeDominio}%` }}
                  />
                </span>
                <span className={styles.topicPct} style={{ color: '#dc2626' }}>
                  {Math.round(topic.porcentajeDominio)}%
                </span>
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>
              ¡Excelente! No tienes temas pendientes de refuerzo.
            </p>
          )}
        </Card>
      </div>

      <Card
        title="Práctica adaptativa"
        subtitle="Ejercicios personalizados según tu progreso y errores recientes"
      >
        {completed < 1 ? (
          <div className={styles.practiceNotice}>
            <p className={styles.emptyText}>
              Completa al menos una evaluación formal para desbloquear prácticas
              adaptativas personalizadas.
            </p>
          </div>
        ) : practicaResumen ? (
          <div className={styles.practiceSummary}>
            <p className={styles.practiceSummaryTitle}>{practicaResumen.titulo}</p>
            <p className={styles.practiceSummaryText}>{practicaResumen.descripcion}</p>
            <ul className={styles.practiceSummaryList}>
              <li>
                <strong>Último porcentaje:</strong> {practicaResumen.ultimoPorcentaje}%
              </li>
              <li>
                <strong>Nivel actual:</strong> {practicaResumen.nivelActualLabel}
              </li>
              <li>
                <strong>Dificultad de la práctica:</strong>{' '}
                {practicaResumen.dificultadPracticaLabel}
              </li>
              <li>
                <strong>Enfoque:</strong> {practicaResumen.enfoque}
              </li>
              {practicaResumen.temasEnfoque?.length > 0 && (
                <li>
                  <strong>Temas:</strong> {practicaResumen.temasEnfoque.join(', ')}
                </li>
              )}
            </ul>
            <div className={styles.practiceActions}>
              <Button
                variant="primary"
                onClick={() =>
                  navigate('/estudiante/evaluacion', {
                    state: {
                      evaluacionId: practicaEvaluacionId,
                      practicaResumen,
                    },
                  })
                }
              >
                Comenzar práctica
              </Button>
              <Button variant="ghost" onClick={() => setPracticaResumen(null)}>
                Cerrar resumen
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.practiceBlock}>
            <p className={styles.emptyText}>
              Genera una práctica con preguntas acordes a tu nivel (
              {levelLabel.toLowerCase()}) y a los temas donde más necesitas reforzar.
            </p>
            {practicaError && (
              <p className={styles.practiceError} role="alert">
                {practicaError}
              </p>
            )}
            <Button
              variant="primary"
              onClick={handleGenerarPractica}
              disabled={generatingPractice}
            >
              {generatingPractice
                ? 'Generando práctica…'
                : 'Generar práctica adaptativa'}
            </Button>
          </div>
        )}
      </Card>

      <Card
        title="Recomendaciones adaptativas"
        subtitle={`Según tu nivel ${levelLabel.toLowerCase()} y tus errores previos`}
      >
        {recommendations.length > 0 ? (
          <div className={styles.recommendList}>
            {recommendations.map((rec, index) => (
              <div key={index} className={styles.recommendItem}>
                <span className={styles.recommendIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <p className={styles.recommendText}>{rec}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>
            Aún no hay recomendaciones disponibles.
          </p>
        )}
      </Card>

      <div style={{ marginTop: '22px' }}>
        <Card title="Historial de evaluaciones" subtitle="Todas tus evaluaciones">
          {history.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Evaluación</th>
                    <th>Fecha</th>
                    <th>Nota</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>{item.titulo}</td>
                      <td>{formatFecha(item.fecha)}</td>
                      <td
                        className={styles.scorePill}
                        style={{ color: getScoreColor(item.nota) }}
                      >
                        {item.nota}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            item.aprobado ? styles.statusApproved : styles.statusFailed
                          }`}
                        >
                          {item.aprobado ? 'Aprobada' : 'Reprobada'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.emptyText}>Aún no tienes evaluaciones registradas.</p>
          )}
        </Card>
      </div>

      <div className={styles.actions}>
        <Button variant="outline" onClick={() => navigate('/estudiante/cursos')}>
          Ir a mis cursos
        </Button>
      </div>
    </>
  )
}

export default EstudianteProgreso
