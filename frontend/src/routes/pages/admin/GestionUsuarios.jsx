import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, PageHeader } from '../../../components/index.js'
import adminService from '../../../services/adminService.js'
import styles from './GestionUsuarios.module.css'

const formularioVacio = {
  username: '', dni: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '',
  telefono: '', especialidad: '', codigoEstudiante: '', fechaNacimiento: '',
}

const perfilDe = (usuario, esDocente) => (
  esDocente ? usuario.perfilDocente : usuario.perfilEstudiante
)

function GestionUsuarios({ tipo }) {
  const esDocente = tipo === 'docentes'
  const titulo = esDocente ? 'Docentes' : 'Estudiantes'
  const [usuarios, setUsuarios] = useState([])
  const [paginacion, setPaginacion] = useState({ pagina: 1, paginas: 1, total: 0 })
  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(formularioVacio)
  const [saving, setSaving] = useState(false)
  const [temporal, setTemporal] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [anios, setAnios] = useState([])
  const [secciones, setSecciones] = useState([])
  const [matricula, setMatricula] = useState({ anioAcademicoId: '', seccionId: '', estado: 'ACTIVO' })
  const [importacion, setImportacion] = useState({ archivo: null, anioAcademicoId: '', seccionId: '' })
  const [credenciales, setCredenciales] = useState([])

  const cargar = async (page = pagina, q = busqueda) => {
    const data = await adminService.listarUsuarios(tipo, { page, q })
    setUsuarios(data.usuarios)
    setPaginacion(data.paginacion)
  }

  useEffect(() => {
    let activo = true
    const timer = setTimeout(() => {
      adminService.listarUsuarios(tipo, { page: pagina, q: busqueda })
        .then((data) => {
          if (!activo) return
          setUsuarios(data.usuarios)
          setPaginacion(data.paginacion)
          setError('')
        })
        .catch((err) => activo && setError(err.mensaje || `No se pudieron cargar los ${titulo.toLowerCase()}.`))
        .finally(() => activo && setLoading(false))
    }, 250)
    return () => {
      activo = false
      clearTimeout(timer)
    }
  }, [busqueda, pagina, tipo, titulo])

  const abrirCrear = () => {
    setSeleccionado(null)
    setForm(formularioVacio)
    setError('')
    setModal('formulario')
  }

  const abrirEditar = (usuario) => {
    const perfil = perfilDe(usuario, esDocente) || {}
    setSeleccionado(usuario)
    setForm({
      ...formularioVacio,
      username: usuario.username || '',
      dni: perfil.dni || '',
      nombres: perfil.nombres || '',
      apellidoPaterno: perfil.apellidoPaterno || '',
      apellidoMaterno: perfil.apellidoMaterno || '',
      telefono: perfil.telefono || '',
      especialidad: perfil.especialidad || '',
      codigoEstudiante: perfil.codigoEstudiante || '',
      fechaNacimiento: perfil.fechaNacimiento?.slice(0, 10) || '',
    })
    setError('')
    setModal('formulario')
  }

  const guardar = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form }
      if (!payload.username) delete payload.username
      if (seleccionado) {
        await adminService.actualizarUsuario(tipo, seleccionado.id, payload)
        setModal(null)
      } else {
        const resultado = await adminService.crearUsuario(tipo, payload)
        setTemporal(resultado.contrasenaTemporal)
        setSeleccionado(resultado.usuario)
        setModal('temporal')
      }
      await cargar(1, busqueda)
      setPagina(1)
    } catch (err) {
      setError(err.mensaje || 'No se pudo guardar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  const cambiarEstado = async (usuario, estado) => {
    try {
      await adminService.cambiarEstado(usuario.id, estado)
      await cargar()
    } catch (err) {
      setError(err.mensaje || 'No se pudo cambiar el estado.')
    }
  }

  const restablecer = async (usuario) => {
    setSaving(true)
    setError('')
    try {
      const resultado = await adminService.restablecerPassword(usuario.id)
      setSeleccionado(usuario)
      setTemporal(resultado.contrasenaTemporal)
      setModal('temporal')
      await cargar()
    } catch (err) {
      setError(err.mensaje || 'No se pudo restablecer la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  const abrirDetalle = async (usuario) => {
    setSeleccionado(usuario)
    setDetalle(null)
    setModal('detalle')
    try {
      const data = esDocente
        ? await adminService.obtenerAsignaciones(usuario.id)
        : await adminService.obtenerRendimiento(usuario.id)
      setDetalle(data)
    } catch (err) {
      setDetalle({ error: err.mensaje || 'No se pudo cargar la información.' })
    }
  }

  const abrirMatricula = async (usuario) => {
    setSeleccionado(usuario)
    setError('')
    const actual = usuario.matriculasAcademicas?.[0]
    setMatricula({
      anioAcademicoId: actual?.anioAcademicoId ? String(actual.anioAcademicoId) : '',
      seccionId: actual?.seccionId ? String(actual.seccionId) : '',
      estado: actual?.estado || 'ACTIVO',
    })
    setModal('matricula')
    try {
      const [listaAnios, listaSecciones] = await Promise.all([
        adminService.listarAnios(), adminService.listarSecciones(),
      ])
      setAnios(listaAnios)
      setSecciones(listaSecciones)
    } catch (err) {
      setError(err.mensaje || 'No se pudo cargar la estructura académica.')
    }
  }

  const guardarMatricula = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await adminService.cambiarMatricula(seleccionado.id, {
        anioAcademicoId: Number(matricula.anioAcademicoId),
        seccionId: Number(matricula.seccionId),
        estado: matricula.estado,
      })
      setModal(null)
      await cargar()
    } catch (err) {
      setError(err.mensaje || 'No se pudo guardar la matrícula.')
    } finally {
      setSaving(false)
    }
  }

  const abrirImportacion = async () => {
    setError('')
    setImportacion({ archivo: null, anioAcademicoId: '', seccionId: '' })
    setCredenciales([])
    setModal('importacion')
    try {
      const [listaAnios, listaSecciones] = await Promise.all([
        adminService.listarAnios(), adminService.listarSecciones(),
      ])
      setAnios(listaAnios)
      setSecciones(listaSecciones)
    } catch (err) {
      setError(err.mensaje || 'No se pudo cargar la estructura académica.')
    }
  }

  const importarEstudiantes = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const resultado = await adminService.importarEstudiantes(
        importacion.archivo,
        importacion.anioAcademicoId,
        importacion.seccionId,
      )
      setCredenciales(resultado.credenciales || [])
      setModal('credenciales-importacion')
      await cargar(1, busqueda)
      setPagina(1)
    } catch (err) {
      setError(err.mensaje || 'No se pudo importar el archivo.')
    } finally {
      setSaving(false)
    }
  }

  const camposEspecificos = useMemo(() => esDocente
    ? [{ name: 'especialidad', label: 'Especialidad', type: 'text' }]
    : [
        { name: 'codigoEstudiante', label: 'Código de estudiante', type: 'text' },
        { name: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date' },
      ], [esDocente])

  return (
    <section>
      <PageHeader
        title={titulo}
        subtitle={`Administra las cuentas institucionales de ${titulo.toLowerCase()}.`}
        actions={<div className={styles.headerActions}>
          {!esDocente && <Button variant="secondary" onClick={abrirImportacion}>Importar Excel</Button>}
          <Button onClick={abrirCrear}>Crear {esDocente ? 'docente' : 'estudiante'}</Button>
        </div>}
      />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={busqueda}
          onChange={(event) => { setBusqueda(event.target.value); setPagina(1) }}
          placeholder={esDocente ? 'Buscar por nombre, DNI o username' : 'Buscar por nombre, DNI, código o username'}
          aria-label={`Buscar ${titulo.toLowerCase()}`}
        />
        <span className={styles.total}>{paginacion.total} registros</span>
      </div>

      {error && <div className={styles.alert}>{error}</div>}
      {loading ? <div className={styles.state}>Cargando…</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Usuario</th><th>Datos personales</th><th>Estado</th><th>Información académica</th><th>Acciones</th></tr></thead>
            <tbody>
              {usuarios.map((usuario) => {
                const perfil = perfilDe(usuario, esDocente)
                const actual = usuario.matriculasAcademicas?.[0]
                return <tr key={usuario.id}>
                  <td><strong>@{usuario.username}</strong><small>{usuario.debeCambiarPassword ? 'Cambio de clave pendiente' : 'Clave actualizada'}</small></td>
                  <td><strong>{usuario.nombres}</strong><small>DNI {perfil?.dni || '—'}{!esDocente && perfil?.codigoEstudiante ? ` · ${perfil.codigoEstudiante}` : ''}</small></td>
                  <td>
                    <select className={styles.status} value={usuario.estado} onChange={(event) => cambiarEstado(usuario, event.target.value)}>
                      <option value="ACTIVO">Activo</option><option value="BLOQUEADO">Bloqueado</option><option value="INACTIVO">Inactivo</option>
                    </select>
                  </td>
                  <td><small>{esDocente
                    ? `${usuario._count?.asignacionesDocente || 0} asignaciones`
                    : actual ? `${actual.seccion.grado.nombre} ${actual.seccion.nombre} · ${actual.anioAcademico.anio}` : 'Sin matrícula académica'}</small></td>
                  <td><div className={styles.actions}>
                    <button onClick={() => abrirEditar(usuario)}>Editar</button>
                    {!esDocente && <button onClick={() => abrirMatricula(usuario)}>Matrícula</button>}
                    <button onClick={() => abrirDetalle(usuario)}>{esDocente ? 'Asignaciones' : 'Rendimiento'}</button>
                    <button disabled={saving} onClick={() => restablecer(usuario)}>Restablecer clave</button>
                  </div></td>
                </tr>
              })}
            </tbody>
          </table>
          {!usuarios.length && <div className={styles.state}>No hay registros para mostrar.</div>}
        </div>
      )}

      <div className={styles.pagination}>
        <Button variant="secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
        <span>Página {paginacion.pagina} de {paginacion.paginas}</span>
        <Button variant="secondary" disabled={pagina >= paginacion.paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
      </div>

      <Modal isOpen={modal === 'formulario'} onClose={() => setModal(null)} title={`${seleccionado ? 'Editar' : 'Crear'} ${esDocente ? 'docente' : 'estudiante'}`}>
        <form className={styles.form} onSubmit={guardar}>
          {error && <div className={styles.alert}>{error}</div>}
          <div className={styles.grid}>
            <label>Username opcional<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Se genera automáticamente" /></label>
            <label>DNI<input required pattern="[0-9]{8}" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} /></label>
            <label>Nombres<input required value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} /></label>
            <label>Apellido paterno<input required value={form.apellidoPaterno} onChange={(e) => setForm({ ...form, apellidoPaterno: e.target.value })} /></label>
            <label>Apellido materno<input required value={form.apellidoMaterno} onChange={(e) => setForm({ ...form, apellidoMaterno: e.target.value })} /></label>
            <label>Teléfono<input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label>
            {camposEspecificos.map((campo) => <label key={campo.name}>{campo.label}<input type={campo.type} value={form[campo.name]} onChange={(e) => setForm({ ...form, [campo.name]: e.target.value })} /></label>)}
          </div>
          <div className={styles.modalActions}><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'temporal'} onClose={() => { setModal(null); setTemporal('') }} title="Contraseña temporal">
        <div className={styles.temporary}><p>Entrega esta contraseña a <strong>@{seleccionado?.username}</strong>. Solo se muestra en este momento.</p><code>{temporal}</code><Button onClick={() => navigator.clipboard.writeText(temporal)}>Copiar contraseña</Button></div>
      </Modal>

      <Modal isOpen={modal === 'matricula'} onClose={() => setModal(null)} title="Matrícula académica">
        <form className={styles.form} onSubmit={guardarMatricula}>
          {error && <div className={styles.alert}>{error}</div>}
          <label>Año académico<select required value={matricula.anioAcademicoId} onChange={(e) => setMatricula({ ...matricula, anioAcademicoId: e.target.value })}><option value="">Selecciona</option>{anios.map((item) => <option key={item.id} value={item.id}>{item.anio} · {item.estado}</option>)}</select></label>
          <label>Grado y sección<select required value={matricula.seccionId} onChange={(e) => setMatricula({ ...matricula, seccionId: e.target.value })}><option value="">Selecciona</option>{secciones.filter((item) => item.estado === 'ACTIVO').map((item) => <option key={item.id} value={item.id}>{item.grado.nombre} · {item.nombre}</option>)}</select></label>
          <label>Estado<select value={matricula.estado} onChange={(e) => setMatricula({ ...matricula, estado: e.target.value })}><option value="ACTIVO">Activa</option><option value="INACTIVO">Inactiva</option></select></label>
          <div className={styles.modalActions}><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button type="submit" disabled={saving}>Guardar matrícula</Button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'detalle'} onClose={() => setModal(null)} title={esDocente ? 'Asignaciones académicas' : 'Calificaciones y progreso'}>
        {!detalle ? <div className={styles.state}>Cargando…</div> : detalle.error ? <div className={styles.alert}>{detalle.error}</div> : esDocente ? (
          <div className={styles.detailList}>{detalle.map((item) => <article key={item.id}><strong>{item.areaCurricular.nombre}</strong><span>{item.seccion.grado.nombre} {item.seccion.nombre} · {item.anioAcademico.anio} · {item.estado}</span></article>)}{!detalle.length && <p>Sin asignaciones académicas.</p>}</div>
        ) : (
          <div className={styles.detailList}>
            <h3>Calificaciones</h3>{detalle.intentos.map((item) => <article key={item.id}><strong>{item.evaluacion.titulo} · Nota final: {item.notaFinal ?? item.nota ?? '—'}</strong><span>{item.evaluacion.curso.nombre} · {item.porcentaje}% · {item.nivelObtenido || 'Sin nivel'}{item.modificadaPorDocente ? ' · Revisada por docente' : ''}</span></article>)}{!detalle.intentos.length && <p>Sin evaluaciones finalizadas.</p>}
            <h3>Progreso</h3>{detalle.progresos.map((item) => <article key={item.id}><strong>{item.tema} · {item.porcentajeDominio}%</strong><span>{item.curso.nombre} · {item.nivelActual}</span></article>)}{!detalle.progresos.length && <p>Sin registros de progreso.</p>}
          </div>
        )}
      </Modal>

      <Modal isOpen={modal === 'importacion'} onClose={() => setModal(null)} title="Importar estudiantes institucionales">
        <form className={styles.form} onSubmit={importarEstudiantes}>
          {error && <div className={styles.alert}>{error}</div>}
          <p>El archivo no contiene contraseñas. La plataforma genera una clave temporal distinta para cada cuenta.</p>
          <Button type="button" variant="secondary" onClick={() => adminService.descargarPlantillaEstudiantes()}>
            Descargar plantilla
          </Button>
          <label>Archivo Excel<input required type="file" accept=".xlsx" onChange={(event) => setImportacion({ ...importacion, archivo: event.target.files?.[0] || null })} /></label>
          <label>Año académico<select required value={importacion.anioAcademicoId} onChange={(event) => setImportacion({ ...importacion, anioAcademicoId: event.target.value })}><option value="">Selecciona</option>{anios.map((item) => <option key={item.id} value={item.id}>{item.anio} · {item.estado}</option>)}</select></label>
          <label>Grado y sección<select required value={importacion.seccionId} onChange={(event) => setImportacion({ ...importacion, seccionId: event.target.value })}><option value="">Selecciona</option>{secciones.filter((item) => item.estado === 'ACTIVO').map((item) => <option key={item.id} value={item.id}>{item.grado.nombre} · {item.nombre}</option>)}</select></label>
          <div className={styles.modalActions}><Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Importando…' : 'Importar'}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'credenciales-importacion'} onClose={() => { setModal(null); setCredenciales([]) }} title="Credenciales temporales">
        <div className={styles.temporary}>
          <p>Guarda y entrega estas credenciales ahora. Las contraseñas no volverán a mostrarse.</p>
          <div className={styles.credentials}>{credenciales.map((item) => <code key={item.username}>{item.username}: {item.contrasenaTemporal}</code>)}</div>
          <Button onClick={() => navigator.clipboard.writeText(credenciales.map((item) => `${item.username}: ${item.contrasenaTemporal}`).join('\n'))}>Copiar todas</Button>
        </div>
      </Modal>
    </section>
  )
}

export default GestionUsuarios
