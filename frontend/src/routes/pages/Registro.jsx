import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/index.js'
import authService from '../../services/authService.js'
import styles from './Registro.module.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 6

const ROLES = [
  {
    value: 'docente',
    label: 'Docente',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" />
      </svg>
    ),
  },
  {
    value: 'estudiante',
    label: 'Estudiante',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
      </svg>
    ),
  },
]

function Registro() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'docente',
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => navigate('/login'), 1800)
    return () => clearTimeout(timer)
  }, [success, navigate])

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  const selectRole = (role) => {
    setForm((prev) => ({ ...prev, role }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!form.fullName.trim()) {
      nextErrors.fullName = 'Los nombres completos son obligatorios.'
    }

    if (!form.email.trim()) {
      nextErrors.email = 'El correo es obligatorio.'
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      nextErrors.email = 'Ingresa un correo con un formato válido.'
    }

    if (!form.password) {
      nextErrors.password = 'La contraseña es obligatoria.'
    } else if (form.password.length < MIN_PASSWORD) {
      nextErrors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Confirma tu contraseña.'
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.'
    }

    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      await authService.registro({
        nombres: form.fullName.trim(),
        correo: form.email.trim(),
        contrasena: form.password,
        rol: form.role === 'docente' ? 'DOCENTE' : 'ESTUDIANTE',
      })
      // Registro correcto: confirmamos y redirigimos a login (useEffect).
      setSuccess(true)
    } catch (error) {
      setErrors({ form: error.mensaje || 'No se pudo crear la cuenta.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">
            E
          </span>
          <span className={styles.logoText}>
            Evalua<span className={styles.logoAccent}>IA</span>
          </span>
        </Link>

        <h1 className={styles.title}>Crear cuenta</h1>
        <p className={styles.subtitle}>
          Regístrate para empezar a usar la evaluación adaptativa.
        </p>

        {success ? (
          <div className={styles.success} role="status">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>¡Registro exitoso! Redirigiendo al inicio de sesión…</span>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {errors.form && <div className={styles.formError}>{errors.form}</div>}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">
                Nombres completos
              </label>
              <input
                id="fullName"
                type="text"
                className={`${styles.input} ${
                  errors.fullName ? styles.inputError : ''
                }`}
                placeholder="Ej. María López García"
                value={form.fullName}
                onChange={handleChange('fullName')}
                aria-invalid={Boolean(errors.fullName)}
              />
              {errors.fullName && (
                <span className={styles.errorText}>{errors.fullName}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                className={`${styles.input} ${
                  errors.email ? styles.inputError : ''
                }`}
                placeholder="tu@correo.com"
                value={form.email}
                onChange={handleChange('email')}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && (
                <span className={styles.errorText}>{errors.email}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className={`${styles.input} ${
                  errors.password ? styles.inputError : ''
                }`}
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={handleChange('password')}
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password && (
                <span className={styles.errorText}>{errors.password}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirmPassword">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={`${styles.input} ${
                  errors.confirmPassword ? styles.inputError : ''
                }`}
                placeholder="Repite tu contraseña"
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              {errors.confirmPassword && (
                <span className={styles.errorText}>
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Registrarme como</span>
              <div
                className={styles.roleGroup}
                role="radiogroup"
                aria-label="Rol"
              >
                {ROLES.map((role) => {
                  const selected = form.role === role.value
                  return (
                    <label
                      key={role.value}
                      className={`${styles.roleOption} ${
                        selected ? styles.roleSelected : ''
                      }`}
                    >
                      <input
                        className={styles.roleInput}
                        type="radio"
                        name="role"
                        value={role.value}
                        checked={selected}
                        onChange={() => selectRole(role.value)}
                      />
                      <span className={styles.roleIcon}>{role.icon}</span>
                      <span className={styles.roleLabel}>{role.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>
        )}

        <p className={styles.footer}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className={styles.link}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Registro
