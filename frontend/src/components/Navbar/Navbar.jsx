import { Link } from 'react-router-dom'
import styles from './Navbar.module.css'

function Navbar({ onMenuClick, role }) {
  const roleLabel =
    role === 'docente' ? 'Docente' : role === 'estudiante' ? 'Estudiante' : null

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={onMenuClick}
          aria-label="Abrir menú de navegación"
        >
          <span className={styles.menuIcon} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <Link to="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">
            E
          </span>
          <span className={styles.logoText}>
            Evalua<span className={styles.logoAccent}>IA</span>
          </span>
        </Link>
      </div>

      <div className={styles.right}>
        {roleLabel && <span className={styles.roleBadge}>{roleLabel}</span>}
        <span className={styles.avatar} aria-hidden="true">
          {roleLabel ? roleLabel.charAt(0) : 'U'}
        </span>
      </div>
    </header>
  )
}

export default Navbar
