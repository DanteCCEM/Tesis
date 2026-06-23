import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import styles from './Dashboard.module.css'

const STAT_ICONS = {
  cursos: (
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Zm0 0A2.5 2.5 0 0 0 6.5 22H20v-5" />
  ),
  estudiantes: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  evaluaciones: (
    <path d="M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  ),
}

function DocenteDashboard() {
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchCourses = () => {
    setLoading(true)
    cursosService
      .misCursos()
      .then((data) => {
        setCourses(data)
        setError('')
      })
      .catch((err) => setError(err.mensaje || 'No se pudo cargar tu panel.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelado = false
    cursosService
      .misCursos()
      .then((data) => {
        if (!cancelado) {
          setCourses(data)
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

  const totalCursos = courses.length
  const totalEstudiantes = courses.reduce(
    (acc, c) => acc + (c._count?.matriculas ?? 0),
    0,
  )
  const totalEvaluaciones = courses.reduce(
    (acc, c) => acc + (c._count?.evaluaciones ?? 0),
    0,
  )

  const stats = [
    { key: 'cursos', label: 'Cursos activos', value: totalCursos, accent: false },
    {
      key: 'estudiantes',
      label: 'Estudiantes matriculados',
      value: totalEstudiantes,
      accent: true,
    },
    {
      key: 'evaluaciones',
      label: 'Evaluaciones creadas',
      value: totalEvaluaciones,
      accent: false,
    },
  ]

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Bienvenido, docente" />
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
        <PageHeader eyebrow="Panel docente" title="Bienvenido, docente" />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCourses}>
            Reintentar
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Panel docente"
        title="Bienvenido, docente"
        subtitle="Este es el resumen de tu actividad académica."
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/docente/crear-evaluacion')}
          >
            Crear nueva evaluación
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
          subtitle="Cursos que has creado"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/docente/cursos')}
            >
              Ver todos
            </Button>
          }
        >
          {courses.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Grado / Sección</th>
                    <th>Estudiantes</th>
                    <th>Evaluaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id}>
                      <td className={styles.evalName}>{course.nombre}</td>
                      <td className={styles.muted}>
                        {course.grado} {course.seccion}
                      </td>
                      <td>{course._count?.matriculas ?? 0}</td>
                      <td>{course._count?.evaluaciones ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.emptyText}>
              Aún no tienes cursos. Crea tu primer curso para empezar.
            </p>
          )}
        </Card>

        <Card
          title="Acciones rápidas"
          subtitle="Gestiona tu actividad docente"
        >
          <div className={styles.reinforceList}>
            <Button
              variant="outline"
              fullWidth
              onClick={() => navigate('/docente/cursos')}
            >
              Gestionar cursos y matrículas
            </Button>
            <div style={{ height: '10px' }} />
            <Button
              variant="outline"
              fullWidth
              onClick={() => navigate('/docente/crear-evaluacion')}
            >
              Crear una evaluación
            </Button>
            <div style={{ height: '10px' }} />
            <Button
              variant="outline"
              fullWidth
              onClick={() => navigate('/docente/resultados')}
            >
              Ver resultados
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}

export default DocenteDashboard
