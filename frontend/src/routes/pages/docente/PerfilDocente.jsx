import { useEffect, useState } from 'react'
import { Button, Card, PageHeader } from '../../../components/index.js'
import authService from '../../../services/authService.js'
import perfilService from '../../../services/perfilService.js'
import styles from '../perfil/Perfil.module.css'

function getInitials(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

const EMPTY_FORM = {
  nombres: '',
  correo: '',
  fotoPerfil: '',
  telefono: '',
  institucionEducativa: '',
  biografiaCorta: '',
}

function PerfilDocente() {
  const [perfil, setPerfil] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPerfil = () => {
    setLoading(true)
    perfilService
      .obtenerMiPerfil()
      .then((data) => {
        setPerfil(data)
        setForm({
          nombres: data.nombres ?? '',
          correo: data.correo ?? '',
          fotoPerfil: data.fotoPerfil ?? '',
          telefono: data.telefono ?? '',
          institucionEducativa: data.institucionEducativa ?? '',
          biografiaCorta: data.biografiaCorta ?? '',
        })
        setError('')
      })
      .catch((err) => setError(err.mensaje || 'No se pudo cargar tu perfil.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelado = false
    perfilService
      .obtenerMiPerfil()
      .then((data) => {
        if (!cancelado) {
          setPerfil(data)
          setForm({
            nombres: data.nombres ?? '',
            correo: data.correo ?? '',
            fotoPerfil: data.fotoPerfil ?? '',
            telefono: data.telefono ?? '',
            institucionEducativa: data.institucionEducativa ?? '',
            biografiaCorta: data.biografiaCorta ?? '',
          })
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err.mensaje || 'No se pudo cargar tu perfil.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setFormError('')
    setSuccess('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setSuccess('')
    try {
      const actualizado = await perfilService.actualizarMiPerfil({
        nombres: form.nombres.trim(),
        correo: form.correo.trim(),
        fotoPerfil: form.fotoPerfil.trim() || null,
        telefono: form.telefono.trim() || null,
        institucionEducativa: form.institucionEducativa.trim() || null,
        biografiaCorta: form.biografiaCorta.trim() || null,
      })
      setPerfil(actualizado)
      const sesion = authService.getUsuario()
      if (sesion) {
        authService.setUsuario({
          ...sesion,
          nombres: actualizado.nombres,
          correo: actualizado.correo,
        })
      }
      setSuccess('Perfil actualizado correctamente.')
    } catch (err) {
      setFormError(err.mensaje || 'No se pudo guardar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Mi perfil" />
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.stateText}>Cargando tu perfil…</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Panel docente" title="Mi perfil" />
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <h2 className={styles.stateTitle}>Ocurrió un error</h2>
          <p className={styles.stateText}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPerfil}>
            Reintentar
          </Button>
        </div>
      </>
    )
  }

  const stats = perfil?.estadisticas ?? {}

  return (
    <>
      <PageHeader
        eyebrow="Panel docente"
        title="Mi perfil"
        subtitle="Administra tu información y revisa tu actividad docente."
      />

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{stats.cursosCreados ?? 0}</p>
          <p className={styles.statLabel}>Cursos creados</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{stats.cantidadEstudiantes ?? 0}</p>
          <p className={styles.statLabel}>Estudiantes matriculados</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{stats.evaluacionesPublicadas ?? 0}</p>
          <p className={styles.statLabel}>Evaluaciones publicadas</p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.profileCard}>
          {perfil?.fotoPerfil ? (
            <span className={styles.avatar}>
              <img src={perfil.fotoPerfil} alt="" />
            </span>
          ) : (
            <span className={styles.avatar}>{getInitials(perfil?.nombres ?? 'D')}</span>
          )}
          <h2 className={styles.name}>{perfil?.nombres}</h2>
          <p className={styles.role}>Docente · {perfil?.correo}</p>
          {perfil?.institucionEducativa && (
            <p className={styles.institution}>{perfil.institucionEducativa}</p>
          )}
          {perfil?.telefono && (
            <p className={styles.institution}>{perfil.telefono}</p>
          )}
          {perfil?.biografiaCorta ? (
            <p className={styles.bio}>{perfil.biografiaCorta}</p>
          ) : (
            <p className={styles.emptyText}>Aún no has añadido una biografía.</p>
          )}
        </div>

        <Card title="Editar perfil" subtitle="Los cambios se guardan en tu cuenta">
          <form className={styles.form} onSubmit={handleSubmit}>
            {formError && (
              <div className={styles.formError} role="alert">
                {formError}
              </div>
            )}
            {success && (
              <div className={styles.success} role="status">
                {success}
              </div>
            )}

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="nombres">
                  Nombres
                </label>
                <input
                  id="nombres"
                  className={styles.input}
                  value={form.nombres}
                  onChange={handleChange('nombres')}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="correo">
                  Correo
                </label>
                <input
                  id="correo"
                  type="email"
                  className={styles.input}
                  value={form.correo}
                  onChange={handleChange('correo')}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="telefono">
                  Teléfono
                </label>
                <input
                  id="telefono"
                  className={styles.input}
                  value={form.telefono}
                  onChange={handleChange('telefono')}
                  placeholder="Opcional"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="institucion">
                  Institución educativa
                </label>
                <input
                  id="institucion"
                  className={styles.input}
                  value={form.institucionEducativa}
                  onChange={handleChange('institucionEducativa')}
                  placeholder="Opcional"
                />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="foto">
                  URL de foto de perfil
                </label>
                <input
                  id="foto"
                  className={styles.input}
                  value={form.fotoPerfil}
                  onChange={handleChange('fotoPerfil')}
                  placeholder="https://… (opcional)"
                />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="bio">
                  Biografía corta
                </label>
                <textarea
                  id="bio"
                  className={styles.textarea}
                  value={form.biografiaCorta}
                  onChange={handleChange('biografiaCorta')}
                  placeholder="Cuéntanos sobre tu experiencia docente (opcional)"
                  maxLength={500}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}

export default PerfilDocente
