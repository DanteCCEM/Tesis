import styles from './PageHeader.module.css'

function PageHeader({ title, subtitle, eyebrow, actions, className = '' }) {
  const classes = [styles.pageHeader, className].filter(Boolean).join(' ')

  return (
    <header className={classes}>
      <div className={styles.text}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}

export default PageHeader
