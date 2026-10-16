# Gestión de usuarios ADMIN

Las rutas `/admin/docentes` y `/admin/estudiantes` requieren JWT vigente, una
contraseña inicial ya cambiada y rol `ADMIN`.

## Creación

La API crea `Usuario` y su perfil institucional en una transacción. Si no se
envía `username`, se genera a partir del primer nombre y apellido paterno y se
añade un sufijo cuando sea necesario. La contraseña temporal se genera en el
servidor, se almacena como hash bcrypt y se devuelve una sola vez con cabeceras
`no-store`.

Los usuarios heredados sin `PerfilDocente` o `PerfilEstudiante` aparecen en el
listado. Al completar y guardar sus datos desde el formulario, la API crea el
perfil faltante.

## Endpoints

- `GET|POST /api/admin/docentes`
- `PUT /api/admin/docentes/:id`
- `GET /api/admin/docentes/:id/asignaciones`
- `GET|POST /api/admin/estudiantes`
- `PUT /api/admin/estudiantes/:id`
- `PUT /api/admin/estudiantes/:id/matricula-academica`
- `GET /api/admin/estudiantes/:id/rendimiento`
- `PATCH /api/admin/usuarios/:id/estado`
- `POST /api/admin/usuarios/:id/restablecer-password`

Los listados aceptan `page`, `pageSize` y `q`. No se expone una ruta para
eliminar usuarios físicamente.
