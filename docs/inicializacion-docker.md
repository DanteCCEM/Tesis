# Inicialización segura con Docker

El backend ejecuta `prisma migrate deploy` en cada inicio. Esta operación aplica únicamente migraciones pendientes y no elimina datos.

El seed está desactivado por defecto mediante `RUN_SEED=false`. Por eso un reinicio de Docker no intenta recrear cuentas demo ni administradores.

Para preparar una base nueva, configura temporalmente en `.env` las variables `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NOMBRES` y opcionalmente `ADMIN_CORREO`, y ejecuta el seed manualmente:

```powershell
docker compose run --rm backend npm run seed
```

El seed es idempotente. Busca por username y correo; reutiliza cuentas existentes sin actualizar contraseña, rol, estado ni datos personales. Si ambos identificadores pertenecen a usuarios diferentes, termina con un error explícito para que el conflicto se resuelva manualmente.

Después de crear el administrador, deja `RUN_SEED=false` y levanta los servicios normalmente:

```powershell
docker compose up -d --build
docker compose logs -f backend
```

Para validar el seed dos veces, se puede ejecutar dos veces el comando manual anterior. La segunda ejecución no crea duplicados ni cambia la contraseña de las cuentas existentes.
