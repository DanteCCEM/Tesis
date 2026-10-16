# Sistema Inteligente de Evaluación Educativa Basado en Inteligencia Artificial

Proyecto de tesis desarrollado para apoyar el proceso de evaluación educativa en estudiantes de secundaria. La plataforma busca mejorar la evaluación, el seguimiento del aprendizaje y la retroalimentación mediante el uso de inteligencia artificial y analítica de datos.

## Descripción

El sistema permite gestionar cursos, estudiantes, evaluaciones y resultados académicos desde perfiles diferenciados para docentes y estudiantes.

La propuesta está orientada a que los docentes puedan realizar un seguimiento más claro del desempeño de sus estudiantes, mientras que los estudiantes puedan visualizar sus avances, notas y nivel de aprendizaje.

La integración de inteligencia artificial se plantea para ofrecer retroalimentación adaptativa según el desempeño obtenido en las evaluaciones.

## Problema que aborda

En muchas instituciones educativas, el proceso de evaluación suele realizarse de forma manual, con retroalimentación limitada y poco seguimiento individual del progreso de cada estudiante.

Este proyecto busca contribuir a resolver estas dificultades mediante una plataforma que permita:

- Registrar y administrar cursos, estudiantes y evaluaciones.
- Visualizar notas y progreso académico.
- Identificar el nivel de desempeño de cada estudiante.
- Brindar retroalimentación adaptativa según los resultados.
- Reducir parte de la carga operativa del docente durante el proceso de evaluación.

## Objetivo general

Desarrollar un sistema inteligente de evaluación educativa basado en inteligencia artificial que contribuya al seguimiento del aprendizaje y al rendimiento académico de estudiantes de educación secundaria.

## Usuarios del sistema

### Docente
- Visualizar las asignaciones académicas creadas por el administrador.
- Visualizar los estudiantes matriculados en sus secciones.
- Consultar notas, resultados y nivel de desempeño.
- Crear y administrar evaluaciones.
- Realizar seguimiento del progreso académico de los estudiantes.

### Estudiante
- Iniciar sesión con una cuenta institucional creada por un administrador.
- Visualizar los cursos en los que se encuentra matriculado.
- Resolver evaluaciones asignadas.
- Consultar sus notas, progreso y nivel de desempeño.
- Recibir retroalimentación relacionada con sus resultados.

## Funcionalidades implementadas

- Inicio de sesión local mediante username y contraseña.
- Cuentas institucionales administradas con roles ADMIN, DOCENTE y ESTUDIANTE.
- Cambio obligatorio de contraseña en el primer acceso.
- Estado de cuenta e invalidación de sesiones al restablecer contraseñas.
- Gestión de cursos.
- Visualización de cursos por usuario.
- Módulo de evaluaciones.
- Registro de resultados académicos.
- Visualización de progreso del estudiante.
- Paneles principales para docente y estudiante.
- Conexión con base de datos PostgreSQL.

## Funcionalidades en desarrollo

- Integración de inteligencia artificial para retroalimentación adaptativa.
- Clasificación automática del nivel de desempeño del estudiante.
- Restricción para que cada evaluación pueda resolverse una sola vez.
- Bloqueo de evaluaciones después de su envío.
- Módulo completo de perfiles de docente y estudiante.
- Visualización detallada de estudiantes, notas y niveles desde el panel del docente.
- Reportes académicos y analítica de aprendizaje.

## Tecnologías utilizadas

- Frontend: React + Vite
- Navegación: React Router DOM
- Backend: API conectada a base de datos
- Base de datos: PostgreSQL
- Gestión de variables de entorno: archivo `.env`
- Control de versiones: Git y GitHub

## Recuperación de cuentas institucionales

Un administrador autenticado puede restablecer una cuenta mediante
`POST /api/admin/usuarios/:id/restablecer-password`. La API genera una
contraseña temporal, almacena solo su hash, invalida las sesiones anteriores y
devuelve la contraseña una sola vez. El usuario debe cambiarla al iniciar sesión.

Los cambios de contraseña y de estado quedan registrados en `Auditoria`. Al
bloquear o inactivar una cuenta se invalidan sus sesiones. El sistema rechaza
la operación si dejaría a la plataforma sin administradores activos.

Para recuperar un administrador directamente desde el servidor:

```bash
cd backend
npm run admin:reset -- nombre.usuario
```

El comando activa la cuenta indicada, genera una contraseña temporal, obliga a
cambiarla en el siguiente acceso y registra el origen `EMERGENCY_CLI`. La
contraseña se muestra una sola vez en la terminal y no se guarda en auditoría.

## Variables de investigación relacionadas

Este sistema se desarrolla en relación con las siguientes variables de investigación:

- **Variable independiente:** Sistema inteligente de evaluación educativa basado en inteligencia artificial.
- **Variable intermedia:** Retroalimentación adaptativa y seguimiento del aprendizaje.
- **Variable dependiente:** Rendimiento académico en áreas curriculares de educación secundaria.

## Estructura general del sistema

```text
Sistema de Evaluación Educativa
│
├── Frontend
│   ├── Inicio de sesión y cambio de contraseña
│   ├── Panel de docente
│   ├── Panel de estudiante
│   ├── Cursos
│   ├── Evaluaciones
│   ├── Progreso académico
│   └── Perfil de usuario
│
├── Backend
│   ├── Autenticación
│   ├── Gestión de usuarios
│   ├── Gestión de cursos
│   ├── Gestión de estudiantes
│   ├── Gestión de evaluaciones
│   ├── Registro de notas
│   └── Procesamiento de resultados
│
└── Base de datos
    ├── Usuarios
    ├── Cursos
    ├── Matrículas
    ├── Evaluaciones
    ├── Preguntas
    ├── Intentos
    └── Resultados
