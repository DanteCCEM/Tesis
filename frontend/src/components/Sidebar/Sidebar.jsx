import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import authService from '../../services/authService.js'
import styles from './Sidebar.module.css'

const ICONS = {
  dashboard: (
    <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
  ),
  cursos: (
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Zm0 0A2.5 2.5 0 0 0 6.5 22H20v-5" />
  ),
  crear: <path d="M12 5v14M5 12h14" />,
  resultados: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  progreso: <path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5" />,
  perfil: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  plan: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
}

const NAV_ITEMS = {
  docente: [
    { to: '/docente/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/docente/cursos', label: 'Mis cursos', icon: 'cursos' },
    {
      to: '/docente/plan-curricular',
      label: 'Plan curricular',
      icon: 'plan',
    },
    {
      to: '/docente/crear-evaluacion',
      label: 'Crear evaluación',
      icon: 'crear',
    },
    { to: '/docente/resultados', label: 'Resultados', icon: 'resultados' },
    { to: '/docente/perfil', label: 'Mi perfil', icon: 'perfil' },
  ],
  estudiante: [
    { to: '/estudiante/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/estudiante/cursos', label: 'Mis cursos', icon: 'cursos' },
    { to: '/estudiante/progreso', label: 'Mi progreso', icon: 'progreso' },
    { to: '/estudiante/resultados', label: 'Resultados', icon: 'resultados' },
    { to: '/estudiante/perfil', label: 'Mi perfil', icon: 'perfil' },
  ],
}

function Icon({ name }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

function Sidebar({ role = 'docente', isOpen = false, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const items = NAV_ITEMS[role] ?? []
  const sectionLabel = role === 'docente' ? 'Panel docente' : 'Panel estudiante'

  const classes = [styles.sidebar, isOpen ? styles.open : '']
    .filter(Boolean)
    .join(' ')

  const handleLogout = () => {
    authService.logout()
    onNavigate?.()
    navigate('/login', { replace: true })
  }

  return (
    <aside className={classes} aria-label="Navegación principal">
      <div className={styles.inner}>
        <span className={styles.section}>{sectionLabel}</span>
        <nav className={styles.nav}>
          {items.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => {
                const active =
                  isActive ||
                  (item.activePattern &&
                    location.pathname.includes(item.activePattern))
                return [styles.link, active ? styles.active : '']
                  .filter(Boolean)
                  .join(' ')
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            <Icon name="logout" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
