import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/index.js'
import authService from '../../services/authService.js'
import styles from './Login.module.css'

const destinoPorRol = (rol) => {
  if (rol === 'DOCENTE') return '/docente/dashboard'
  if (rol === 'ESTUDIANTE') return '/estudiante/dashboard'
  return '/admin/dashboard'
}

function CambiarPassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.actual || form.nueva.length < 12) {
      setError('Completa la contraseña actual y una nueva de al menos 12 caracteres.')
      return
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.nueva)) {
      setError('La nueva contraseña debe incluir mayúscula, minúscula, número y símbolo.')
      return
    }
    if (form.nueva !== form.confirmar) {
      setError('La confirmación no coincide con la nueva contraseña.')
      return
    }
    setLoading(true)
    try {
      const { usuario } = await authService.cambiarPassword({
        contrasenaActual: form.actual,
        nuevaContrasena: form.nueva,
      })
      navigate(destinoPorRol(usuario.rol), { replace: true })
    } catch (err) {
      setError(err.mensaje || 'No se pudo cambiar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">E</span>
          <span className={styles.logoText}>Evalua<span className={styles.logoAccent}>IA</span></span>
        </Link>
        <h1 className={styles.title}>Cambia tu contraseña</h1>
        <p className={styles.subtitle}>
          Por seguridad debes establecer una contraseña personal antes de continuar.
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.formError}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="passwordActual">Contraseña actual</label>
            <input id="passwordActual" type="password" autoComplete="current-password"
              className={styles.input} value={form.actual} onChange={handleChange('actual')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="passwordNueva">Nueva contraseña</label>
            <input id="passwordNueva" type="password" autoComplete="new-password"
              minLength="12" maxLength="128" className={styles.input}
              value={form.nueva} onChange={handleChange('nueva')} />
            <span className={styles.errorText}>
              Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="passwordConfirmar">Confirma la nueva contraseña</label>
            <input id="passwordConfirmar" type="password" autoComplete="new-password"
              className={styles.input} value={form.confirmar} onChange={handleChange('confirmar')} />
          </div>
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
            {loading ? 'Actualizando…' : 'Guardar nueva contraseña'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default CambiarPassword
