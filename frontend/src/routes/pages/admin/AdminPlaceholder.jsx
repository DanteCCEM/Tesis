import { PageHeader } from '../../../components/index.js'

function AdminPlaceholder({ title = 'Dashboard' }) {
  return (
    <section>
      <PageHeader title={title} subtitle="Este módulo se habilitará en la siguiente etapa del panel administrativo." />
    </section>
  )
}

export default AdminPlaceholder
