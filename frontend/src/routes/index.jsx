import { Routes, Route, useLocation } from 'react-router-dom'

import AppLayout from '../layouts/AppLayout/AppLayout.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import NotFound from './pages/NotFound.jsx'

import DocenteDashboard from './pages/docente/Dashboard.jsx'
import DocenteCursos from './pages/docente/Cursos.jsx'
import DetalleCursoDocente from './pages/docente/DetalleCursoDocente.jsx'
import PlanCurricular from './pages/docente/PlanCurricular.jsx'
import PlanCurricularCurso from './pages/docente/PlanCurricularCurso.jsx'
import DocenteCrearEvaluacion from './pages/docente/CrearEvaluacion.jsx'
import DocenteResultados from './pages/docente/Resultados.jsx'
import PerfilDocente from './pages/docente/PerfilDocente.jsx'

import EstudianteDashboard from './pages/estudiante/Dashboard.jsx'
import EstudianteCursos from './pages/estudiante/Cursos.jsx'
import TemasDelCurso from './pages/estudiante/TemasDelCurso.jsx'
import EstudianteEvaluacion from './pages/estudiante/Evaluacion.jsx'
import EstudianteResultados from './pages/estudiante/Resultados.jsx'
import EstudianteProgreso from './pages/estudiante/Progreso.jsx'
import PerfilEstudiante from './pages/estudiante/PerfilEstudiante.jsx'

function AppRoutes() {
  const location = useLocation()

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route element={<ProtectedRoute role="DOCENTE" />}>
        <Route element={<AppLayout role="docente" />}>
          <Route path="/docente/dashboard" element={<DocenteDashboard />} />
          <Route path="/docente/cursos" element={<DocenteCursos />} />
          <Route path="/docente/plan-curricular" element={<PlanCurricular />} />
          <Route
            path="/docente/cursos/:id"
            element={<DetalleCursoDocente key={location.pathname} />}
          />
          <Route
            path="/docente/cursos/:cursoId/plan-curricular"
            element={<PlanCurricularCurso key={location.pathname} />}
          />
          <Route
            path="/docente/crear-evaluacion"
            element={<DocenteCrearEvaluacion />}
          />
          <Route path="/docente/resultados" element={<DocenteResultados />} />
          <Route path="/docente/perfil" element={<PerfilDocente />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="ESTUDIANTE" />}>
        <Route element={<AppLayout role="estudiante" />}>
          <Route path="/estudiante/dashboard" element={<EstudianteDashboard />} />
          <Route path="/estudiante/cursos" element={<EstudianteCursos />} />
          <Route
            path="/estudiante/cursos/:cursoId/temas"
            element={<TemasDelCurso key={location.pathname} />}
          />
          <Route path="/estudiante/evaluacion" element={<EstudianteEvaluacion />} />
          <Route path="/estudiante/resultados" element={<EstudianteResultados />} />
          <Route path="/estudiante/progreso" element={<EstudianteProgreso />} />
          <Route path="/estudiante/perfil" element={<PerfilEstudiante />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default AppRoutes
