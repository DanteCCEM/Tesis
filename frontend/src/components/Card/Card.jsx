import styles from './Card.module.css'

function Card({
  children,
  title,
  subtitle,
  icon,
  actions,
  className = '',
  ...props
}) {
  const hasHeader = title || subtitle || actions || icon
  const classes = [styles.card, className].filter(Boolean).join(' ')

  return (
    <section className={classes} {...props}>
      {hasHeader && (
        <header className={styles.header}>
          <div className={styles.heading}>
            {icon && <span className={styles.icon}>{icon}</span>}
            <div>
              {title && <h3 className={styles.title}>{title}</h3>}
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  )
}

export default Card
