import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>404</h1>
      <p>La página que buscas no existe.</p>
      <Link to="/">Volver al inicio</Link>
    </main>
  )
}

export default NotFound
