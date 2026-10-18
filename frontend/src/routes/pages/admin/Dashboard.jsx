import { useEffect, useState } from 'react'
import { Card, PageHeader } from '../../../components/index.js'
import progresoService from '../../../services/progresoService.js'
import styles from '../docente/Dashboard.module.css'

function AdminDashboard() {
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    progresoService.resumenAdmin().then(setResumen).catch((err) => setError(err.mensaje || 'No se pudo cargar el resumen académico.'))
  }, [])

  return (
    <>
      <PageHeader eyebrow="Panel administrador" title="Seguimiento académico global" subtitle="Consulta de solo lectura basada en el historial real de aprendizaje." />
      {error ? <p>{error}</p> : (
        <>
          <div className={styles.stats}>
            <div className={styles.statCard}><span className={styles.statValue}>{resumen?.estudiantesActivos ?? 0}</span><span className={styles.statLabel}>Estudiantes activos</span></div>
            <div className={styles.statCard}><span className={styles.statValue}>{resumen?.evaluacionesFinalizadas ?? 0}</span><span className={styles.statLabel}>Evaluaciones finalizadas</span></div>
            <div className={styles.statCard}><span className={styles.statValue}>{resumen?.registrosHistoricos ?? 0}</span><span className={styles.statLabel}>Registros históricos</span></div>
          </div>
          <Card title="Distribución global por nivel" subtitle="Resumen de perfiles actuales por tema.">
            <div className={styles.stats}>
              {['BASICO', 'INTERMEDIO', 'AVANZADO'].map((nivel) => <div className={styles.statCard} key={nivel}><span className={styles.statValue}>{resumen?.distribucionNiveles?.[nivel] ?? 0}</span><span className={styles.statLabel}>{nivel}</span></div>)}
            </div>
          </Card>
          <Card title="Últimos registros de progreso" subtitle="El administrador puede consultar, pero no modificar resultados.">
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Estudiante</th><th>Tema</th><th>Nota</th><th>Porcentaje</th><th>Cambio</th><th>Fecha</th></tr></thead><tbody>
              {(resumen?.ultimosCambios ?? []).map((item) => <tr key={item.id}><td>{item.estudiante.nombres}</td><td>{item.tema}</td><td>{item.nota}</td><td>{item.porcentaje}%</td><td>{item.nivelAntes} → {item.nivelDespues}</td><td>{new Date(item.fecha).toLocaleDateString('es-PE')}</td></tr>)}
            </tbody></table></div>
          </Card>
        </>
      )}
    </>
  )
}

export default AdminDashboard
