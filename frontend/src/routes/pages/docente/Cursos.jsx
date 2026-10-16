import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PageHeader } from '../../../components/index.js'
import cursosService from '../../../services/cursosService.js'
import styles from './Cursos.module.css'

function Cursos() {
  const navigate = useNavigate()
  const [cursos, setCursos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    cursosService.misCursos()
      .then((data) => { if (activo) setCursos(data) })
      .catch((err) => { if (activo) setError(err.mensaje || 'No se pudieron cargar las asignaciones.') })
      .finally(() => { if (activo) setLoading(false) })
    return () => { activo = false }
  }, [])

  return (
    <section>
      <PageHeader eyebrow="Asignaciones académicas" title="Mis cursos" subtitle="La administración asigna tus áreas, secciones y años académicos." />
      {loading && <div className={styles.state}><div className={styles.spinner} /><p>Cargando asignaciones…</p></div>}
      {error && <div className={`${styles.state} ${styles.stateError}`}><h2 className={styles.stateTitle}>No se pudieron cargar</h2><p>{error}</p></div>}
      {!loading && !error && !cursos.length && <div className={styles.state}><h2 className={styles.stateTitle}>Sin asignaciones activas</h2><p>La administración aún no te asignó cursos para el año activo.</p></div>}
      {!loading && !error && cursos.length > 0 && <div className={styles.grid}>
        {cursos.map((curso) => <article className={styles.courseCard} key={curso.id}>
          <div className={styles.banner} /><div className={styles.courseBody}>
            <span className={styles.gradeBadge}>{curso.grado} · Sección {curso.seccion} · {curso.anio}</span>
            <h2 className={styles.courseName}>{curso.nombre}</h2><p className={styles.courseDesc}>{curso.descripcion || 'Área curricular institucional'}</p>
            <div className={styles.metrics}><span className={styles.metric}><strong className={styles.metricValue}>{curso.cantidadEstudiantes || 0}</strong><small className={styles.metricLabel}>Estudiantes</small></span><span className={styles.metric}><strong className={styles.metricValue}>{curso._count?.evaluaciones || 0}</strong><small className={styles.metricLabel}>Evaluaciones</small></span></div>
          </div><div className={styles.actions}><Button onClick={() => navigate(`/docente/cursos/${curso.id}`)}>Ver curso</Button><Button variant="secondary" onClick={() => navigate(`/docente/crear-evaluacion?cursoId=${curso.id}`)}>Crear evaluación</Button></div>
        </article>)}
      </div>}
    </section>
  )
}

export default Cursos
