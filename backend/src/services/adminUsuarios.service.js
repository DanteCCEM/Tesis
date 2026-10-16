const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { generarPasswordTemporal } = require("../utils/password");

const SALT_ROUNDS = 10;
const PAGE_SIZE_MAX = 100;

const idValido = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest("id inválido");
  return id;
};

const limpiar = (valor) => String(valor ?? "").trim();
const normalizarUsername = (valor) => limpiar(valor)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, ".")
  .replace(/^[._-]+|[._-]+$/g, "")
  .slice(0, 40);

const nombreCompleto = (datos) => [
  datos.nombres,
  datos.apellidoPaterno,
  datos.apellidoMaterno,
].map(limpiar).filter(Boolean).join(" ");

const crearUsernameDisponible = async (tx, datos, solicitado) => {
  let base = solicitado
    ? normalizarUsername(solicitado)
    : normalizarUsername(`${limpiar(datos.nombres).split(/\s+/)[0]}.${datos.apellidoPaterno}`);
  if (base.length < 3) base = normalizarUsername(`usuario.${datos.dni}`);
  if (base.length < 3) base = "usuario";

  if (solicitado) {
    const existe = await tx.usuario.findUnique({ where: { username: base }, select: { id: true } });
    if (existe) throw ApiError.conflict("El username ya está en uso");
    return base;
  }

  for (let sufijo = 0; sufijo < 10000; sufijo += 1) {
    const cola = sufijo === 0 ? "" : `.${sufijo + 1}`;
    const candidato = `${base.slice(0, 40 - cola.length)}${cola}`;
    const existe = await tx.usuario.findUnique({ where: { username: candidato }, select: { id: true } });
    if (!existe) return candidato;
  }
  throw ApiError.conflict("No se pudo generar un username disponible");
};

const perfilSelect = {
  id: true,
  usuarioId: true,
  dni: true,
  nombres: true,
  apellidoPaterno: true,
  apellidoMaterno: true,
  telefono: true,
};

const selectUsuario = (rol) => ({
  id: true,
  username: true,
  nombres: true,
  rol: true,
  estado: true,
  debeCambiarPassword: true,
  ultimoAcceso: true,
  createdAt: true,
  ...(rol === "DOCENTE"
    ? {
        perfilDocente: { select: { ...perfilSelect, especialidad: true } },
        _count: { select: { asignacionesDocente: true, cursos: true } },
      }
    : {
        perfilEstudiante: { select: { ...perfilSelect, codigoEstudiante: true, fechaNacimiento: true } },
        matriculasAcademicas: {
          orderBy: { anioAcademico: { anio: "desc" } },
          take: 1,
          include: { anioAcademico: true, seccion: { include: { grado: true } } },
        },
        _count: { select: { intentos: true, matriculas: true } },
      }),
});

const filtroBusqueda = (rol, busqueda) => {
  const q = limpiar(busqueda);
  if (!q) return { rol };
  const perfil = rol === "DOCENTE" ? "perfilDocente" : "perfilEstudiante";
  const camposPerfil = [
    { dni: { contains: q, mode: "insensitive" } },
    { nombres: { contains: q, mode: "insensitive" } },
    { apellidoPaterno: { contains: q, mode: "insensitive" } },
    { apellidoMaterno: { contains: q, mode: "insensitive" } },
  ];
  if (rol === "ESTUDIANTE") camposPerfil.push({ codigoEstudiante: { contains: q, mode: "insensitive" } });
  return {
    rol,
    OR: [
      { username: { contains: q, mode: "insensitive" } },
      { nombres: { contains: q, mode: "insensitive" } },
      { [perfil]: { is: { OR: camposPerfil } } },
    ],
  };
};

const manejarPrisma = (error) => {
  if (error?.code === "P2002") throw ApiError.conflict("El username, DNI o código ya está registrado");
  if (error?.code === "P2025") throw ApiError.notFound("Usuario no encontrado");
  throw error;
};

const adminUsuariosService = {
  async listar(rol, query) {
    const pagina = Math.max(1, Number(query.page) || 1);
    const limite = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(query.pageSize) || 10));
    const where = filtroBusqueda(rol, query.q);
    const [total, usuarios] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        select: selectUsuario(rol),
        orderBy: [{ nombres: "asc" }, { id: "asc" }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);
    return {
      usuarios,
      paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
    };
  },

  async crear(rol, datos, actorId) {
    const contrasenaTemporal = generarPasswordTemporal();
    const contrasena = await bcrypt.hash(contrasenaTemporal, SALT_ROUNDS);
    try {
      const usuario = await prisma.$transaction(async (tx) => {
        const username = await crearUsernameDisponible(tx, datos, datos.username);
        const creado = await tx.usuario.create({
          data: {
            username,
            nombres: nombreCompleto(datos),
            contrasena,
            rol,
            estado: "ACTIVO",
            debeCambiarPassword: true,
          },
        });
        const perfilBase = {
          usuarioId: creado.id,
          dni: limpiar(datos.dni),
          nombres: limpiar(datos.nombres),
          apellidoPaterno: limpiar(datos.apellidoPaterno),
          apellidoMaterno: limpiar(datos.apellidoMaterno),
          telefono: limpiar(datos.telefono) || null,
        };
        if (rol === "DOCENTE") {
          await tx.perfilDocente.create({
            data: { ...perfilBase, especialidad: limpiar(datos.especialidad) || null },
          });
        } else {
          await tx.perfilEstudiante.create({
            data: {
              ...perfilBase,
              codigoEstudiante: limpiar(datos.codigoEstudiante) || null,
              fechaNacimiento: datos.fechaNacimiento ? new Date(datos.fechaNacimiento) : null,
            },
          });
        }
        await tx.auditoria.create({
          data: {
            usuarioActorId: actorId,
            usuarioObjetivoId: creado.id,
            accion: "USER_CREATED",
            datos: { rol, username },
          },
        });
        return tx.usuario.findUnique({ where: { id: creado.id }, select: selectUsuario(rol) });
      });
      return { usuario, contrasenaTemporal };
    } catch (error) {
      return manejarPrisma(error);
    }
  },

  async actualizar(rol, usuarioId, datos, actorId) {
    const id = idValido(usuarioId);
    try {
      return await prisma.$transaction(async (tx) => {
        const existente = await tx.usuario.findFirst({ where: { id, rol }, select: { id: true } });
        if (!existente) throw ApiError.notFound("Usuario no encontrado");
        const perfilData = {
          ...(datos.dni !== undefined ? { dni: limpiar(datos.dni) } : {}),
          ...(datos.nombres !== undefined ? { nombres: limpiar(datos.nombres) } : {}),
          ...(datos.apellidoPaterno !== undefined ? { apellidoPaterno: limpiar(datos.apellidoPaterno) } : {}),
          ...(datos.apellidoMaterno !== undefined ? { apellidoMaterno: limpiar(datos.apellidoMaterno) } : {}),
          ...(datos.telefono !== undefined ? { telefono: limpiar(datos.telefono) || null } : {}),
          ...(rol === "DOCENTE" && datos.especialidad !== undefined
            ? { especialidad: limpiar(datos.especialidad) || null } : {}),
          ...(rol === "ESTUDIANTE" && datos.codigoEstudiante !== undefined
            ? { codigoEstudiante: limpiar(datos.codigoEstudiante) || null } : {}),
          ...(rol === "ESTUDIANTE" && datos.fechaNacimiento !== undefined
            ? { fechaNacimiento: datos.fechaNacimiento ? new Date(datos.fechaNacimiento) : null } : {}),
        };
        const perfilModelo = rol === "DOCENTE" ? tx.perfilDocente : tx.perfilEstudiante;
        const perfilExistente = await perfilModelo.findUnique({ where: { usuarioId: id } });
        if (perfilExistente) {
          await perfilModelo.update({ where: { usuarioId: id }, data: perfilData });
        } else {
          const requeridos = ["dni", "nombres", "apellidoPaterno", "apellidoMaterno"];
          if (requeridos.some((campo) => !perfilData[campo])) {
            throw ApiError.badRequest("Completa los datos personales para crear el perfil institucional");
          }
          await perfilModelo.create({ data: { usuarioId: id, ...perfilData } });
        }
        if (datos.username !== undefined || datos.nombres !== undefined || datos.apellidoPaterno !== undefined || datos.apellidoMaterno !== undefined) {
          const perfil = await perfilModelo.findUnique({ where: { usuarioId: id } });
          await tx.usuario.update({
            where: { id },
            data: {
              ...(datos.username !== undefined ? { username: normalizarUsername(datos.username) } : {}),
              nombres: nombreCompleto(perfil),
            },
          });
        }
        await tx.auditoria.create({
          data: {
            usuarioActorId: actorId,
            usuarioObjetivoId: id,
            accion: "USER_UPDATED",
            datos: { campos: Object.keys(datos).filter((campo) => campo !== "contrasena") },
          },
        });
        return tx.usuario.findUnique({ where: { id }, select: selectUsuario(rol) });
      });
    } catch (error) {
      return manejarPrisma(error);
    }
  },

  async asignacionesDocente(usuarioId) {
    const id = idValido(usuarioId);
    const docente = await prisma.usuario.findFirst({ where: { id, rol: "DOCENTE" }, select: { id: true } });
    if (!docente) throw ApiError.notFound("Docente no encontrado");
    return prisma.asignacionCurso.findMany({
      where: { docenteId: id },
      include: { areaCurricular: true, anioAcademico: true, seccion: { include: { grado: true } }, cursoLegacy: { select: { id: true, nombre: true } } },
      orderBy: [{ anioAcademico: { anio: "desc" } }, { areaCurricular: { nombre: "asc" } }],
    });
  },

  async cambiarMatricula(estudianteId, datos, actorId) {
    const id = idValido(estudianteId);
    const anioAcademicoId = idValido(datos.anioAcademicoId);
    const seccionId = idValido(datos.seccionId);
    return prisma.$transaction(async (tx) => {
      const [estudiante, anio, seccion, anterior] = await Promise.all([
        tx.usuario.findFirst({ where: { id, rol: "ESTUDIANTE" }, select: { id: true } }),
        tx.anioAcademico.findUnique({ where: { id: anioAcademicoId } }),
        tx.seccion.findUnique({ where: { id: seccionId }, include: { grado: true } }),
        tx.matriculaAcademica.findUnique({
          where: { estudianteId_anioAcademicoId: { estudianteId: id, anioAcademicoId } },
        }),
      ]);
      if (!estudiante) throw ApiError.notFound("Estudiante no encontrado");
      if (!anio) throw ApiError.notFound("Año académico no encontrado");
      if (!seccion || seccion.estado !== "ACTIVO") throw ApiError.badRequest("La sección no está activa");
      const matricula = await tx.matriculaAcademica.upsert({
        where: { estudianteId_anioAcademicoId: { estudianteId: id, anioAcademicoId } },
        create: { estudianteId: id, anioAcademicoId, seccionId, estado: datos.estado || "ACTIVO" },
        update: { seccionId, estado: datos.estado || "ACTIVO", fechaMatricula: new Date() },
        include: { anioAcademico: true, seccion: { include: { grado: true } } },
      });
      await tx.auditoria.create({
        data: {
          usuarioActorId: actorId,
          usuarioObjetivoId: id,
          accion: "ACADEMIC_ENROLLMENT_CHANGED",
          datos: { anioAcademicoId, seccionAnteriorId: anterior?.seccionId ?? null, seccionId, estado: matricula.estado },
        },
      });
      return matricula;
    });
  },

  async rendimientoEstudiante(usuarioId) {
    const id = idValido(usuarioId);
    const estudiante = await prisma.usuario.findFirst({ where: { id, rol: "ESTUDIANTE" }, select: { id: true } });
    if (!estudiante) throw ApiError.notFound("Estudiante no encontrado");
    const [intentos, progresos] = await Promise.all([
      prisma.intentoEvaluacion.findMany({
        where: { estudianteId: id, estado: "FINALIZADO" },
        select: {
          id: true, puntajeTotal: true, porcentaje: true, nivelObtenido: true, fechaFin: true,
          evaluacion: { select: { id: true, titulo: true, tema: true, curso: { select: { id: true, nombre: true } } } },
        },
        orderBy: { fechaFin: "desc" },
      }),
      prisma.progresoEstudiante.findMany({
        where: { estudianteId: id },
        include: { curso: { select: { id: true, nombre: true } } },
        orderBy: { porcentajeDominio: "desc" },
      }),
    ]);
    return { intentos, progresos };
  },
};

module.exports = adminUsuariosService;
