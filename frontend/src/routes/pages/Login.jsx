import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/index.js'
import authService from '../../services/authService.js'
import styles from './Login.module.css'

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.username.trim()) nextErrors.username = 'El usuario es obligatorio.'
    if (!form.password) nextErrors.password = 'La contraseña es obligatoria.'
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setErrors({})
    try {
      const { usuario } = await authService.login({
        username: form.username.trim(),
        contrasena: form.password,
      })
      if (usuario?.debeCambiarPassword) {
        navigate('/cambiar-password', { replace: true })
      } else if (usuario?.rol === 'DOCENTE') {
        navigate('/docente/dashboard', { replace: true })
      } else if (usuario?.rol === 'ESTUDIANTE') {
        navigate('/estudiante/dashboard', { replace: true })
      } else {
        navigate('/admin/dashboard', { replace: true })
      }
    } catch (error) {
      setErrors({ form: error.mensaje || 'No se pudo iniciar sesión.' })
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
        <h1 className={styles.title}>Iniciar sesión</h1>
        <p className={styles.subtitle}>
          Accede con tu usuario institucional y contraseña.
        </p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {errors.form && <div className={styles.formError}>{errors.form}</div>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">Usuario institucional</label>
            <input id="username" type="text" autoComplete="username"
              className={`${styles.input} ${errors.username ? styles.inputError : ''}`}
              placeholder="usuario.institucional" value={form.username}
              onChange={handleChange('username')} aria-invalid={Boolean(errors.username)} />
            {errors.username && <span className={styles.errorText}>{errors.username}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password"
              className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
              value={form.password} onChange={handleChange('password')}
              aria-invalid={Boolean(errors.password)} />
            {errors.password && <span className={styles.errorText}>{errors.password}</span>}
          </div>
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </Button>
        </form>
        <p className={styles.footer}>
          Las cuentas son creadas por el administrador de la institución.
        </p>
      </div>
    </div>
  )
}

export default Login
