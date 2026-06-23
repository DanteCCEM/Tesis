import { Link, useNavigate } from 'react-router-dom'
import { Button, Card } from '../../components/index.js'
import styles from './Home.module.css'

const BENEFITS = [
  {
    title: 'Evaluación adaptativa',
    text: 'Las preguntas se ajustan en tiempo real al nivel y desempeño de cada estudiante.',
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
        <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: 'Retroalimentación inmediata',
    text: 'Cada respuesta genera comentarios al instante para reforzar el aprendizaje.',
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    ),
  },
  {
    title: 'Seguimiento del progreso',
    text: 'Visualiza la evolución del estudiante con métricas claras a lo largo del tiempo.',
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
        <path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5" />
      </svg>
    ),
  },
]

function Home() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">
            E
          </span>
          <span className={styles.logoText}>
            Evalua<span className={styles.logoAccent}>IA</span>
          </span>
        </Link>
        <div className={styles.topbarActions}>
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Iniciar sesión
          </Button>
          <Button variant="primary" onClick={() => navigate('/registro')}>
            Crear cuenta
          </Button>
        </div>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>Plataforma con inteligencia artificial</span>
        <h1 className={styles.title}>
          Evaluación educativa adaptativa con{' '}
          <span className={styles.titleAccent}>inteligencia artificial</span>
        </h1>
        <p className={styles.subtitle}>
          EvaluaIA ajusta automáticamente cada evaluación según el desempeño del
          estudiante, ofreciendo una experiencia personalizada que identifica
          fortalezas y áreas de mejora en tiempo real.
        </p>
        <div className={styles.actions}>
          <Button size="lg" variant="primary" onClick={() => navigate('/login')}>
            Iniciar sesión
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/registro')}
          >
            Crear cuenta
          </Button>
        </div>
      </section>

      <section className={styles.benefits} aria-label="Beneficios">
        {BENEFITS.map((benefit) => (
          <Card key={benefit.title}>
            <span className={styles.benefitIcon}>{benefit.icon}</span>
            <h2 className={styles.benefitTitle}>{benefit.title}</h2>
            <p className={styles.benefitText}>{benefit.text}</p>
          </Card>
        ))}
      </section>

      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Comienza a evaluar de forma inteligente</h2>
        <p className={styles.ctaText}>
          Crea tu cuenta y descubre cómo la evaluación adaptativa mejora el
          aprendizaje de tus estudiantes.
        </p>
        <Button size="lg" variant="secondary" onClick={() => navigate('/registro')}>
          Crear cuenta gratis
        </Button>
      </section>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} EvaluaIA · Evaluación educativa adaptativa
      </footer>
    </div>
  )
}

export default Home
