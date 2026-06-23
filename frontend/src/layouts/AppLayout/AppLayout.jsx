import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../../components/Navbar/Navbar.jsx'
import Sidebar from '../../components/Sidebar/Sidebar.jsx'
import styles from './AppLayout.module.css'

function AppLayout({ role = 'docente' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)
  const toggleSidebar = () => setSidebarOpen((open) => !open)

  return (
    <div className={styles.layout}>
      <Navbar role={role} onMenuClick={toggleSidebar} />

      <div className={styles.body}>
        <Sidebar role={role} isOpen={sidebarOpen} onNavigate={closeSidebar} />

        {sidebarOpen && (
          <div
            className={styles.overlay}
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <main className={styles.content}>
          <div className={styles.container}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
