import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import authService from '../../../services/authService.js'
import cursosService from '../../../services/cursosService.js'
import progresoService from '../../../services/progresoService.js'
import styles from './Dashboard.module.css'

const STAT_ICONS = {
  cursos: (
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Zm0 0A2.5 2.5 0 0 0 6.5 22H20v-5" />
  ),
  realizadas: (
    <path d="M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  ),
  promedio: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  nivel: <path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5" />,
}

function getScoreClass(score) {
  if (score >= 14) return styles.scoreHigh
  if (score >= 11) return styles.scoreMid
  return styles.scoreLow
}

function formatFecha(valor) {
  if (!valor) return ''
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function EstudianteDashboard() {
  const navigate = useNavigate()
  const usuario = authService.getUsuario()
  const nombre = usuario?.nombres?.split(' ')[0] ?? 'estudiante'

  const [courses, setCourses] = useState([])
  const [progreso, setProgreso] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = () => {
    setLoading(true)
    Promise.all([cursosService.misCursos(), progresoService.miProgreso()])
      .then(([cursos, prog]) => {
        setCourses(cursos)
        setProgreso(prog)
        setError('')
      })
      .catch((err) => setError(err.mensaje || 'No se pudo cargar tu panel.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelado = false
    Promise.all([cursosService.misCursos(), progresoService.miProgreso()])
      .then(([cursos, prog]) => {
        if (!cancelado) {
          setCourses(cursos)
          setProgreso(prog)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err.mensaje || 'No se pudo cargar tu panel.')
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
        <PageHeader eyebrow="Panel estudiante" title={`Hola, ${nombre}`} />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando tu panel…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Panel estudiante" title={`Hola, ${nombre}`} />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Reintentar
          </Button>
        </div>
      </>
    )
  }

  const recientes = (progreso?.historial ?? []).slice(0, 4)
  const recomendaciones = progreso?.recomendaciones ?? []

  const stats = [
    { key: 'cursos', label: 'Cursos activos', value: courses.length, accent: false },
    {
      key: 'realizadas',
      label: 'Evaluaciones realizadas',
      value: progreso?.evaluacionesRealizadas ?? 0,
      accent: true,
    },
    {
      key: 'promedio',
      label: 'Promedio (0–20)',
      value: progreso?.promedioNota ?? 0,
      accent: false,
    },
    {
      key: 'nivel',
      label: 'Nivel actual',
      value: progreso?.nivelLabel ?? 'Básico',
      accent: true,
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Panel estudiante"
        title={`Hola, ${nombre}`}
        subtitle="Este es el resumen de tu actividad y tu progreso."
        actions={
          <Button variant="primary" onClick={() => navigate('/estudiante/progreso')}>
            Ver mi progreso
          </Button>
        }
      />

      <div className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.key} className={styles.statCard}>
            <span
              className={`${styles.statIcon} ${
                stat.accent ? styles.statIconAccent : ''
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {STAT_ICONS[stat.key]}
              </svg>
            </span>
            <div>
              <p className={styles.statValue}>{stat.value}</p>
              <p className={styles.statLabel}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.sections}>
        <Card
          title="Mis cursos"
          subtitle="Cursos en los que estás matriculado"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/estudiante/cursos')}
            >
              Ver todos
            </Button>
          }
        >
          {courses.length > 0 ? (
            courses.map((course) => (
              <div key={course.id} className={styles.pendingItem}>
                <span className={styles.pendingIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z" />
                  </svg>
                </span>
                <div className={styles.pendingInfo}>
                  <p className={styles.pendingName}>{course.nombre}</p>
                  <p className={styles.pendingMeta}>
                    {course.docente?.nombres ?? 'Docente'} ·{' '}
                    {course._count?.evaluaciones ?? 0} evaluación(es)
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>
              Aún no estás matriculado en cursos.
            </p>
          )}
        </Card>

        <Card title="Últimos resultados" subtitle="Tus evaluaciones más recientes">
          {recientes.length > 0 ? (
            recientes.map((item) => (
              <div key={item.id} className={styles.resultItem}>
                <span className={`${styles.resultScore} ${getScoreClass(item.nota)}`}>
                  {item.nota}
                </span>
                <div className={styles.resultInfo}>
                  <p className={styles.resultName}>{item.titulo}</p>
                  <p className={styles.resultMeta}>
                    {item.tema} · {formatFecha(item.fecha)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>
              Todavía no has completado evaluaciones.
            </p>
          )}
        </Card>
      </div>

      <Card title="Recomendaciones para ti" subtitle="Basadas en tu desempeño">
        {recomendaciones.length > 0 ? (
          <div className={styles.recommendList}>
            {recomendaciones.map((rec, index) => (
              <div key={index} className={styles.recommendItem}>
                <span className={styles.recommendIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <div>
                  <p className={styles.recommendText}>{rec}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>
            Completa una evaluación para recibir recomendaciones personalizadas.
          </p>
        )}
      </Card>
    </>
  )
}

export default EstudianteDashboard
