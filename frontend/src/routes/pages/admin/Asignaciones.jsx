import { useEffect, useState } from 'react'
import { Button, Modal, PageHeader } from '../../../components/index.js'
import adminService from '../../../services/adminService.js'
import styles from './GestionUsuarios.module.css'

const vacio = { areaCurricularId: '', seccionId: '', docenteId: '', anioAcademicoId: '', estado: 'ACTIVO' }

function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState([])
  const [catalogos, setCatalogos] = useState({ areas: [], secciones: [], docentes: [], anios: [] })
  const [seleccionada, setSeleccionada] = useState(null)
  const [form, setForm] = useState(vacio)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = async () => {
    const [lista, areas, secciones, docentes, anios] = await Promise.all([
      adminService.listarAsignaciones(),
      adminService.listarAreas(),
      adminService.listarSecciones(),
      adminService.listarUsuarios('docentes', { pageSize: 100 }),
      adminService.listarAnios(),
    ])
    setAsignaciones(lista)
    setCatalogos({ areas, secciones, docentes: docentes.usuarios, anios })
  }

  useEffect(() => {
    let activo = true
    Promise.all([
      adminService.listarAsignaciones(),
      adminService.listarAreas(),
      adminService.listarSecciones(),
      adminService.listarUsuarios('docentes', { pageSize: 100 }),
      adminService.listarAnios(),
    ]).then(([lista, areas, secciones, docentes, anios]) => {
      if (!activo) return
      setAsignaciones(lista)
      setCatalogos({ areas, secciones, docentes: docentes.usuarios, anios })
    }).catch((err) => {
      if (activo) setError(err.mensaje || 'No se pudieron cargar las asignaciones.')
    })
    return () => { activo = false }
  }, [])

  const abrir = (item = null) => {
    setSeleccionada(item)
    setForm(item ? {
      areaCurricularId: String(item.areaCurricularId),
      seccionId: String(item.seccionId),
      docenteId: String(item.docenteId),
      anioAcademicoId: String(item.anioAcademicoId),
      estado: item.estado,
    } : vacio)
    setError('')
    setAbierto(true)
  }

  const guardar = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await adminService.guardarAsignacion({
        ...form,
        areaCurricularId: Number(form.areaCurricularId),
        seccionId: Number(form.seccionId),
        docenteId: Number(form.docenteId),
        anioAcademicoId: Number(form.anioAcademicoId),
      }, seleccionada?.id)
      setAbierto(false)
      await cargar()
    } catch (err) {
      setError(err.mensaje || 'No se pudo guardar la asignación.')
    } finally {
      setSaving(false)
    }
  }

  return <section>
    <PageHeader title="Asignaciones" subtitle="Asigna un docente a un área, sección y año académico." actions={<Button onClick={() => abrir()}>Nueva asignación</Button>} />
    {error && !abierto && <div className={styles.alert}>{error}</div>}
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Área</th><th>Grado y sección</th><th>Docente</th><th>Año</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{asignaciones.map((item) => <tr key={item.id}>
          <td>{item.areaCurricular.nombre}</td>
          <td>{item.seccion.grado.nombre} · {item.seccion.nombre}</td>
          <td>{item.docente.nombres}</td>
          <td>{item.anioAcademico.anio}</td>
          <td>{item.estado}</td>
          <td><div className={styles.actions}><button onClick={() => abrir(item)}>Editar</button></div></td>
        </tr>)}</tbody>
      </table>
      {!asignaciones.length && <div className={styles.state}>No hay asignaciones registradas.</div>}
    </div>

    <Modal isOpen={abierto} onClose={() => setAbierto(false)} title={seleccionada ? 'Editar asignación' : 'Nueva asignación'}>
      <form className={styles.form} onSubmit={guardar}>
        {error && <div className={styles.alert}>{error}</div>}
        <label>Área curricular<select required value={form.areaCurricularId} onChange={(e) => setForm({ ...form, areaCurricularId: e.target.value })}><option value="">Selecciona</option>{catalogos.areas.filter((item) => item.estado === 'ACTIVO').map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label>Grado y sección<select required value={form.seccionId} onChange={(e) => setForm({ ...form, seccionId: e.target.value })}><option value="">Selecciona</option>{catalogos.secciones.filter((item) => item.estado === 'ACTIVO').map((item) => <option key={item.id} value={item.id}>{item.grado.nombre} · {item.nombre}</option>)}</select></label>
        <label>Docente<select required value={form.docenteId} onChange={(e) => setForm({ ...form, docenteId: e.target.value })}><option value="">Selecciona</option>{catalogos.docentes.filter((item) => item.estado === 'ACTIVO').map((item) => <option key={item.id} value={item.id}>{item.nombres} · @{item.username}</option>)}</select></label>
        <label>Año académico<select required value={form.anioAcademicoId} onChange={(e) => setForm({ ...form, anioAcademicoId: e.target.value })}><option value="">Selecciona</option>{catalogos.anios.map((item) => <option key={item.id} value={item.id}>{item.anio} · {item.estado}</option>)}</select></label>
        <label>Estado<select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}><option value="ACTIVO">Activa</option><option value="INACTIVO">Inactiva</option></select></label>
        <div className={styles.modalActions}><Button type="button" variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></div>
      </form>
    </Modal>
  </section>
}

export default Asignaciones
