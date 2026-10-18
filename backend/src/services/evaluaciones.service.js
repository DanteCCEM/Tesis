const prisma = require("../config/prisma");
const { Prisma } = require("../generated/prisma");
const { porcentajeANota20 } = require("../config/learningRules");
const {
  normalizarConfiguracionAdaptativa,
} = require("../config/adaptiveEvaluationRules");
const ApiError = require("../utils/ApiError");
const planCurricularService = require("./planCurricular.service");
const { verificarDocenteCurso, verificarEstudianteCurso } = require("./accesoAcademico.service");

// Verifica que el curso exista y pertenezca al docente indicado.
const verificarCursoPropio = async (cursoId, docenteId) => {
  return verificarDocenteCurso(cursoId, docenteId);
};

// Verifica que la evaluación exista y pertenezca al docente indicado.
const verificarEvaluacionPropia = async (evaluacionId, docenteId) => {
  const evaluacion = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
  });
  if (!evaluacion) {
    throw ApiError.notFound("Evaluación no encontrada");
  }
  await verificarDocenteCurso(evaluacion.cursoId, docenteId);
  return evaluacion;
};

// Indica si el estudiante está matriculado en el curso.
const estaMatriculado = async (cursoId, estudianteId) => {
  await verificarEstudianteCurso(cursoId, estudianteId);
  return true;
};

// Normaliza distintas formas de "verdadero/falso" a un valor canónico.
const normalizarVerdaderoFalso = (valor) => {
  const v = String(valor).trim().toLowerCase();
  return ["true", "verdadero", "v"].includes(v) ? "VERDADERO" : "FALSO";
};

const tiposAdaptativos = new Set([
  "FORMATIVA_ADAPTATIVA",
  "PRACTICA_ADAPTATIVA",
]);

// Quita las respuestas correctas de una evaluación (vista de estudiante).
const ocultarRespuestas = (evaluacion) => ({
  ...evaluacion,
  preguntas: evaluacion.preguntas.map((pregunta) => {
    const { respuestaCorrecta, alternativas, ...resto } = pregunta;
    return {
      ...resto,
      alternativas: alternativas.map((alt) => {
        const { esCorrecta, ...altResto } = alt;
        return altResto;
      }),
    };
  }),
});

const nivelesVariantes = ["BASICO", "INTERMEDIO", "AVANZADO"];

const dificultadPredominante = (preguntas) => {
  const conteo = new Map(nivelesVariantes.map((nivel) => [nivel, 0]));
  for (const pregunta of preguntas) {
    if (conteo.has(pregunta.dificultad)) {
      conteo.set(pregunta.dificultad, conteo.get(pregunta.dificultad) + 1);
    }
  }
  return nivelesVariantes.reduce((mayor, nivel) =>
    conteo.get(nivel) > conteo.get(mayor) ? nivel : mayor,
  "BASICO");
};

const prepararVariantesPublicadas = async (tx, evaluacion, docenteId) => {
  const preguntas = await tx.pregunta.findMany({
    where: { evaluacionId: evaluacion.id },
    orderBy: { id: "asc" },
  });
  const adaptativa = evaluacion.tipoEvaluacion === "FORMATIVA_ADAPTATIVA";
  const grupos = new Map();

  if (adaptativa) {
    for (const nivel of nivelesVariantes) grupos.set(nivel, []);
    for (const pregunta of preguntas) {
      const nivel = pregunta.nivelVariante ?? pregunta.dificultad;
      if (grupos.has(nivel)) grupos.get(nivel).push(pregunta);
    }
  } else {
    grupos.set("COMUN", preguntas);
  }

  const configuracion = adaptativa
    ? normalizarConfiguracionAdaptativa(evaluacion.configuracionAdaptativa)
    : null;
  const objetivos = adaptativa
    ? nivelesVariantes.map((nivel) => ({
        nivelObjetivo: nivel,
        cantidadEsperada: configuracion.porNivel[nivel].cantidadPreguntas,
      }))
    : [{ nivelObjetivo: "COMUN", cantidadEsperada: preguntas.length }];

  for (const objetivo of objetivos) {
    const grupo = grupos.get(objetivo.nivelObjetivo) ?? [];
    if (adaptativa && grupo.length < objetivo.cantidadEsperada) {
      throw ApiError.conflict(
        `La variante ${objetivo.nivelObjetivo} necesita ${objetivo.cantidadEsperada} preguntas y tiene ${grupo.length}`,
      );
    }
  }

  for (const objetivo of objetivos) {
    const grupo = grupos.get(objetivo.nivelObjetivo) ?? [];
    const variante = await tx.varianteEvaluacion.upsert({
      where: {
        evaluacionId_nivelObjetivo: {
          evaluacionId: evaluacion.id,
          nivelObjetivo: objetivo.nivelObjetivo,
        },
      },
      create: {
        evaluacionId: evaluacion.id,
        nivelObjetivo: objetivo.nivelObjetivo,
        cantidadPreguntas: objetivo.cantidadEsperada,
        dificultadPredominante:
          objetivo.nivelObjetivo === "COMUN"
            ? dificultadPredominante(grupo)
            : objetivo.nivelObjetivo,
        estado: "PUBLICADA",
        fechaAprobacion: new Date(),
        docenteAprobadorId: docenteId,
      },
      update: {
        cantidadPreguntas: objetivo.cantidadEsperada,
        dificultadPredominante:
          objetivo.nivelObjetivo === "COMUN"
            ? dificultadPredominante(grupo)
            : objetivo.nivelObjetivo,
        estado: "PUBLICADA",
        fechaAprobacion: new Date(),
        docenteAprobadorId: docenteId,
      },
    });
    await tx.pregunta.updateMany({
      where: { evaluacionId: evaluacion.id, id: { in: grupo.map((p) => p.id) } },
      data: { varianteEvaluacionId: variante.id },
    });
  }
};

const evaluacionesService = {
  // Crea una evaluación en un curso del docente autenticado.
  async crear(datos, docenteId) {
    const cursoId = Number(datos.cursoId);
    const curso = await verificarCursoPropio(cursoId, docenteId);

    const nivel = datos.dificultad ?? datos.nivelDificultad;
    // REGULAR mantiene compatibles clientes anteriores. La UI nueva envía el tipo explícito.
    const tipoEvaluacion = datos.tipoEvaluacion ?? "REGULAR";
    const esAdaptativa = tiposAdaptativos.has(tipoEvaluacion);

    const refs = await planCurricularService.validarReferenciasEvaluacion(
      cursoId,
      datos.temaCurricularId,
      datos.subtemaCurricularId,
    );

    return prisma.evaluacion.create({
      data: {
        titulo: String(datos.titulo).trim(),
        tema: String(datos.tema).trim(),
        subtema: datos.subtema ? String(datos.subtema).trim() : null,
        nivelDificultad: nivel,
        fechaLimite: datos.fechaLimite ? new Date(datos.fechaLimite) : null,
        estado: datos.estado ?? "BORRADOR",
        tipoEvaluacion,
        esAdaptativa,
        ...(esAdaptativa && datos.configuracionAdaptativa != null
          ? {
              configuracionAdaptativa: normalizarConfiguracionAdaptativa(
                datos.configuracionAdaptativa,
              ),
            }
          : {}),
        anioAcademicoId: curso.asignacionCurso?.anioAcademicoId ?? null,
        // Diagnósticas, finales y formativas pertenecen a toda la asignación.
        esPracticaAdaptativa: false,
        estudianteObjetivoId: null,
        cursoId,
        docenteId,
        temaCurricularId: refs.temaCurricularId,
        subtemaCurricularId: refs.subtemaCurricularId,
      },
    });
  },

  // Agrega una pregunta (con alternativas/respuesta) a una evaluación propia.
  async agregarPregunta(evaluacionId, docenteId, datos) {
    await verificarEvaluacionPropia(evaluacionId, docenteId);

    const generadaPorIA = datos.generadaPorIA === true;
    const revisadaPorDocente =
      generadaPorIA && datos.revisadaPorDocente === true;
    const fechaGeneracion = generadaPorIA
      ? datos.fechaGeneracion
        ? new Date(datos.fechaGeneracion)
        : new Date()
      : null;

    const base = {
      enunciado: String(datos.enunciado).trim(),
      tipo: datos.tipo,
      dificultad: datos.dificultad,
      tema: String(datos.tema).trim(),
      puntaje: datos.puntaje !== undefined ? Number(datos.puntaje) : 1,
      evaluacionId,
      generadaPorIA,
      fechaGeneracion,
      modeloGeneracion: generadaPorIA ? datos.modeloGeneracion ?? null : null,
      revisadaPorDocente,
      fechaRevision: revisadaPorDocente ? new Date() : null,
      nivelVariante: datos.nivelVariante ?? null,
    };

    if (datos.tipo === "OPCION_MULTIPLE") {
      return prisma.pregunta.create({
        data: {
          ...base,
          respuestaCorrecta: datos.respuestaCorrecta
            ? String(datos.respuestaCorrecta).trim()
            : null,
          alternativas: {
            create: datos.alternativas.map((alt) => ({
              texto: String(alt.texto).trim(),
              esCorrecta: alt.esCorrecta === true,
            })),
          },
        },
        include: { alternativas: true },
      });
    }

    if (datos.tipo === "VERDADERO_FALSO") {
      const correcta = normalizarVerdaderoFalso(datos.respuestaCorrecta);
      return prisma.pregunta.create({
        data: {
          ...base,
          respuestaCorrecta: correcta,
          alternativas: {
            create: [
              { texto: "Verdadero", esCorrecta: correcta === "VERDADERO" },
              { texto: "Falso", esCorrecta: correcta === "FALSO" },
            ],
          },
        },
        include: { alternativas: true },
      });
    }

    // RESPUESTA_CORTA
    return prisma.pregunta.create({
      data: {
        ...base,
        respuestaCorrecta: String(datos.respuestaCorrecta).trim(),
      },
      include: { alternativas: true },
    });
  },

  // Lista evaluaciones de un curso según el rol del usuario.
  async listarPorCurso(cursoId, usuario) {
    const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
    if (!curso) {
      throw ApiError.notFound("Curso no encontrado");
    }

    if (usuario.rol === "DOCENTE") {
      await verificarDocenteCurso(cursoId, usuario.id);
      return prisma.evaluacion.findMany({
        where: { cursoId, esPracticaAdaptativa: false },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { preguntas: true } } },
      });
    }

    // ESTUDIANTE: solo evaluaciones PUBLICADAS de cursos donde está matriculado.
    const matriculado = await estaMatriculado(cursoId, usuario.id);
    if (!matriculado) {
      throw ApiError.forbidden("No estás matriculado en este curso");
    }

    const evaluaciones = await prisma.evaluacion.findMany({
      where: {
        cursoId,
        estado: "PUBLICADA",
        OR: [
          { esPracticaAdaptativa: false },
          { esPracticaAdaptativa: true, estudianteObjetivoId: usuario.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { preguntas: true } } },
    });

    if (evaluaciones.length === 0) {
      return evaluaciones;
    }

    const intentos = await prisma.intentoEvaluacion.findMany({
      where: {
        estudianteId: usuario.id,
        evaluacionId: { in: evaluaciones.map((ev) => ev.id) },
      },
      select: { id: true, evaluacionId: true, estado: true },
    });

    const intentosPorEvaluacion = new Map(
      intentos.map((intento) => [intento.evaluacionId, intento]),
    );

    return evaluaciones.map((evaluacion) => {
      const miIntento = intentosPorEvaluacion.get(evaluacion.id);
      return {
        ...evaluacion,
        miIntento: miIntento
          ? { id: miIntento.id, estado: miIntento.estado }
          : null,
      };
    });
  },

  // Detalle de una evaluación con sus preguntas (respetando permisos).
  async obtenerDetalle(evaluacionId, usuario) {
    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: evaluacionId },
      include: {
        curso: { select: { id: true, nombre: true, docenteId: true } },
        preguntas: {
          orderBy: { id: "asc" },
          include: { alternativas: { orderBy: { id: "asc" } } },
        },
      },
    });

    if (!evaluacion) {
      throw ApiError.notFound("Evaluación no encontrada");
    }

    if (usuario.rol === "DOCENTE") {
      await verificarDocenteCurso(evaluacion.cursoId, usuario.id);
      return evaluacion;
    }

    // ESTUDIANTE: matriculado y evaluación disponible (formal publicada o práctica personal).
    const matriculado = await estaMatriculado(evaluacion.cursoId, usuario.id);
    if (!matriculado) {
      throw ApiError.forbidden("No estás matriculado en este curso");
    }

    if (evaluacion.esPracticaAdaptativa) {
      if (evaluacion.estudianteObjetivoId !== usuario.id) {
        throw ApiError.forbidden("Esta práctica adaptativa no está disponible para ti");
      }
    } else if (evaluacion.estado !== "PUBLICADA") {
      throw ApiError.forbidden("Esta evaluación no está disponible");
    }

    // Solo se exponen respuestas correctas si ya finalizó un intento.
    const intentoFinalizado = await prisma.intentoEvaluacion.findFirst({
      where: {
        evaluacionId,
        estudianteId: usuario.id,
        estado: "FINALIZADO",
      },
    });

    return intentoFinalizado ? evaluacion : ocultarRespuestas(evaluacion);
  },

  // Edita una evaluación propia (campos parciales).
  async actualizar(evaluacionId, docenteId, datos) {
    const evaluacion = await verificarEvaluacionPropia(evaluacionId, docenteId);

    const data = {};
    if (datos.titulo !== undefined) data.titulo = String(datos.titulo).trim();
    if (datos.tema !== undefined) data.tema = String(datos.tema).trim();
    if (datos.subtema !== undefined) {
      data.subtema = datos.subtema ? String(datos.subtema).trim() : null;
    }
    const nivel = datos.dificultad ?? datos.nivelDificultad;
    if (nivel !== undefined) data.nivelDificultad = nivel;
    if (datos.estado !== undefined) data.estado = datos.estado;
    if (datos.fechaLimite !== undefined) {
      data.fechaLimite = datos.fechaLimite ? new Date(datos.fechaLimite) : null;
    }

    const tipoEvaluacion = datos.tipoEvaluacion ?? evaluacion.tipoEvaluacion;
    if (datos.tipoEvaluacion !== undefined) data.tipoEvaluacion = tipoEvaluacion;
    if (
      datos.tipoEvaluacion !== undefined ||
      datos.esAdaptativa !== undefined
    ) {
      data.esAdaptativa = tiposAdaptativos.has(tipoEvaluacion);
    }
    if (datos.configuracionAdaptativa !== undefined) {
      if (tiposAdaptativos.has(tipoEvaluacion) && datos.configuracionAdaptativa == null) {
        throw ApiError.badRequest(
          "Una evaluación adaptativa requiere configuracionAdaptativa",
        );
      }
      data.configuracionAdaptativa = tiposAdaptativos.has(tipoEvaluacion)
        ? normalizarConfiguracionAdaptativa(datos.configuracionAdaptativa)
        : Prisma.DbNull;
    } else if (!tiposAdaptativos.has(tipoEvaluacion) && datos.tipoEvaluacion !== undefined) {
      data.configuracionAdaptativa = Prisma.DbNull;
    }

    if (["DIAGNOSTICA", "FORMATIVA_ADAPTATIVA", "FINAL"].includes(tipoEvaluacion)) {
      data.esPracticaAdaptativa = false;
      data.estudianteObjetivoId = null;
    }

    if (
      datos.temaCurricularId !== undefined ||
      datos.subtemaCurricularId !== undefined
    ) {
      const temaId =
        datos.temaCurricularId !== undefined
          ? datos.temaCurricularId
          : evaluacion.temaCurricularId;
      const subtemaId =
        datos.subtemaCurricularId !== undefined
          ? datos.subtemaCurricularId
          : evaluacion.subtemaCurricularId;

      const refs = await planCurricularService.validarReferenciasEvaluacion(
        evaluacion.cursoId,
        temaId,
        subtemaId,
      );
      data.temaCurricularId = refs.temaCurricularId;
      data.subtemaCurricularId = refs.subtemaCurricularId;
    }

    return prisma.evaluacion.update({ where: { id: evaluacionId }, data });
  },

  // Publica una evaluación propia.
  async publicar(evaluacionId, docenteId) {
    const evaluacion = await verificarEvaluacionPropia(evaluacionId, docenteId);
    const pendientesRevision = await prisma.pregunta.count({
      where: {
        evaluacionId,
        generadaPorIA: true,
        revisadaPorDocente: false,
      },
    });
    if (pendientesRevision > 0) {
      throw ApiError.conflict(
        `No se puede publicar: ${pendientesRevision} pregunta(s) generada(s) por IA aún no fueron revisadas por el docente`,
      );
    }
    if (evaluacion.tipoEvaluacion === "FORMATIVA_ADAPTATIVA") {
      const configuracion = normalizarConfiguracionAdaptativa(
        evaluacion.configuracionAdaptativa,
      );
      const cantidadMaxima = Math.max(
        ...Object.values(configuracion.porNivel).map(
          (regla) => regla.cantidadPreguntas,
        ),
      );
      const cantidadBanco = await prisma.pregunta.count({
        where: { evaluacionId },
      });
      if (cantidadBanco < cantidadMaxima) {
        throw ApiError.conflict(
          `El banco necesita al menos ${cantidadMaxima} preguntas para cubrir todas las variantes adaptativas; actualmente tiene ${cantidadBanco}`,
        );
      }
    }
    return prisma.$transaction(async (tx) => {
      await prepararVariantesPublicadas(tx, evaluacion, docenteId);
      return tx.evaluacion.update({
        where: { id: evaluacionId },
        data: { estado: "PUBLICADA" },
        include: { variantesEvaluacion: true },
      });
    });
  },

  // Elimina una evaluación propia (preguntas en cascada por el schema).
  async eliminar(evaluacionId, docenteId) {
    await verificarEvaluacionPropia(evaluacionId, docenteId);
    const registrosHistoricos = await prisma.historialProgreso.count({
      where: { evaluacionId },
    });
    if (registrosHistoricos > 0) {
      throw ApiError.conflict(
        "No se puede eliminar una evaluación con historial de aprendizaje",
      );
    }
    await prisma.evaluacion.delete({ where: { id: evaluacionId } });
  },

  // Analítica agregada del aula para una evaluación (solo docente propietario).
  async obtenerAnalitica(evaluacionId, docenteId) {
    await verificarEvaluacionPropia(evaluacionId, docenteId);

    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: evaluacionId },
      include: {
        curso: { select: { id: true, nombre: true } },
        preguntas: {
          select: { id: true, enunciado: true, tema: true },
          orderBy: { id: "asc" },
        },
      },
    });

    const contextoCurso = await verificarDocenteCurso(evaluacion.cursoId, docenteId);
    const [estudiantesMatriculados, intentos] = await Promise.all([
      prisma.matriculaAcademica.count({
        where: {
          seccionId: contextoCurso.asignacionCurso.seccionId,
          anioAcademicoId: contextoCurso.asignacionCurso.anioAcademicoId,
          estado: "ACTIVO",
        },
      }),
      prisma.intentoEvaluacion.findMany({
        where: { evaluacionId, estado: "FINALIZADO" },
        include: {
          estudiante: { select: { id: true, nombres: true, correo: true } },
          varianteEvaluacion: {
            select: {
              id: true,
              nivelObjetivo: true,
              cantidadPreguntas: true,
              dificultadPredominante: true,
            },
          },
          respuestas: {
            include: {
              pregunta: { select: { id: true, tema: true, enunciado: true } },
            },
          },
        },
        orderBy: { porcentaje: "desc" },
      }),
    ]);

    const redondear = (valor) => Math.round(valor * 100) / 100;

    const intentosFinalizados = intentos.length;
    const promedioPorcentaje =
      intentosFinalizados > 0
        ? redondear(
            intentos.reduce((acc, it) => acc + it.porcentaje, 0) /
              intentosFinalizados,
          )
        : 0;

    const estudiantes = intentos.map((it) => {
      const nota = porcentajeANota20(it.porcentaje);
      const temasFallados = [
        ...new Set(
          it.respuestas
            .filter((r) => !r.esCorrecta)
            .map((r) => r.pregunta.tema),
        ),
      ];
      const recomendacion =
        temasFallados.length > 0
          ? `Reforzar: ${temasFallados.slice(0, 2).join(", ")}`
          : "Excelente desempeño; puede avanzar a retos mayores.";

      return {
        id: it.estudianteId,
        intentoId: it.id,
        nombres: it.estudiante.nombres,
        porcentaje: redondear(it.porcentaje),
        nota,
        notaAutomatica: it.notaAutomatica ?? it.nota,
        notaFinal: it.notaFinal ?? it.nota,
        modificadaPorDocente: it.modificadaPorDocente === true,
        motivoModificacion: it.motivoModificacion,
        fechaModificacion: it.fechaModificacion,
        nivelAlRendir: it.nivelAlRendir,
        dificultadVariante: it.dificultadVariante,
        variante: it.varianteEvaluacion
          ? {
              id: it.varianteEvaluacion.id,
              nivelObjetivo: it.varianteEvaluacion.nivelObjetivo,
              cantidadPreguntas: it.varianteEvaluacion.cantidadPreguntas,
              dificultadPredominante: it.varianteEvaluacion.dificultadPredominante,
            }
          : null,
        cantidadPreguntas: it.cantidadPreguntas,
        nivelObtenido: it.nivelObtenido,
        nivelPosterior: it.nivelObtenido,
        aprobado: nota >= 11,
        recomendacion,
      };
    });

    const aprobados = estudiantes.filter((e) => e.aprobado).length;
    const reprobados = estudiantes.filter((e) => !e.aprobado).length;
    const porcentajeAprobacion =
      intentosFinalizados > 0
        ? redondear((aprobados / intentosFinalizados) * 100)
        : 0;
    const esFormativaAdaptativa =
      evaluacion.tipoEvaluacion === "FORMATIVA_ADAPTATIVA";
    if (esFormativaAdaptativa) {
      const ordenNivel = { BASICO: 0, INTERMEDIO: 1, AVANZADO: 2 };
      estudiantes.sort(
        (a, b) =>
          (ordenNivel[a.nivelAlRendir] ?? 0) -
            (ordenNivel[b.nivelAlRendir] ?? 0) ||
          b.porcentaje - a.porcentaje,
      );
    }
    const variantes = new Map();
    for (const intento of intentos) {
      const nivel = intento.nivelAlRendir ?? "BASICO";
      const dificultad = intento.dificultadVariante ?? evaluacion.nivelDificultad;
      const clave = `${nivel}:${dificultad}`;
      const actual = variantes.get(clave) || {
        nivelAlRendir: nivel,
        dificultadVariante: dificultad,
        intentos: 0,
        sumaPorcentaje: 0,
        sumaNota: 0,
        cantidadesPreguntas: new Set(),
      };
      actual.intentos += 1;
      actual.sumaPorcentaje += intento.porcentaje;
      actual.sumaNota += intento.nota ?? porcentajeANota20(intento.porcentaje);
      actual.cantidadesPreguntas.add(intento.cantidadPreguntas);
      variantes.set(clave, actual);
    }
    const resultadosPorVariante = [...variantes.values()].map((variante) => ({
      nivelAlRendir: variante.nivelAlRendir,
      dificultadVariante: variante.dificultadVariante,
      intentos: variante.intentos,
      cantidadesPreguntas: [...variante.cantidadesPreguntas].filter(Boolean),
      promedioPorcentaje: redondear(variante.sumaPorcentaje / variante.intentos),
      promedioNota: redondear(variante.sumaNota / variante.intentos),
    }));

    const preguntaStats = new Map();
    for (const pregunta of evaluacion.preguntas) {
      preguntaStats.set(pregunta.id, {
        id: pregunta.id,
        enunciado: pregunta.enunciado,
        tema: pregunta.tema,
        total: 0,
        incorrectas: 0,
      });
    }

    for (const intento of intentos) {
      for (const respuesta of intento.respuestas) {
        const stat = preguntaStats.get(respuesta.preguntaId);
        if (!stat) continue;
        stat.total += 1;
        if (!respuesta.esCorrecta) stat.incorrectas += 1;
      }
    }

    const preguntasConMasErrores = [...preguntaStats.values()]
      .filter((p) => p.total > 0 && p.incorrectas > 0)
      .map((p) => ({
        id: p.id,
        enunciado: p.enunciado,
        tema: p.tema,
        totalRespuestas: p.total,
        incorrectas: p.incorrectas,
        porcentajeError: redondear((p.incorrectas / p.total) * 100),
      }))
      .sort(
        (a, b) =>
          b.porcentajeError - a.porcentajeError || b.incorrectas - a.incorrectas,
      )
      .slice(0, 8);

    const temaStats = new Map();
    for (const intento of intentos) {
      for (const respuesta of intento.respuestas) {
        const { tema } = respuesta.pregunta;
        if (!temaStats.has(tema)) {
          temaStats.set(tema, { tema, total: 0, incorrectas: 0 });
        }
        const stat = temaStats.get(tema);
        stat.total += 1;
        if (!respuesta.esCorrecta) stat.incorrectas += 1;
      }
    }

    const temasConMasErrores = [...temaStats.values()]
      .filter((t) => t.total > 0 && t.incorrectas > 0)
      .map((t) => ({
        tema: t.tema,
        totalRespuestas: t.total,
        incorrectas: t.incorrectas,
        porcentajeError: redondear((t.incorrectas / t.total) * 100),
      }))
      .sort(
        (a, b) =>
          b.porcentajeError - a.porcentajeError || b.incorrectas - a.incorrectas,
      )
      .slice(0, 8);

    return {
      evaluacion: {
        id: evaluacion.id,
        titulo: evaluacion.titulo,
        tema: evaluacion.tema,
        estado: evaluacion.estado,
        tipoEvaluacion: evaluacion.tipoEvaluacion,
        nivelDificultad: evaluacion.nivelDificultad,
        totalPreguntas: evaluacion.preguntas.length,
        curso: evaluacion.curso,
      },
      resumen: {
        comparabilidad: esFormativaAdaptativa ? "POR_VARIANTE" : "DIRECTA",
        estudiantesMatriculados,
        intentosFinalizados,
        pendientes: Math.max(0, estudiantesMatriculados - intentosFinalizados),
        promedioPorcentaje: esFormativaAdaptativa ? null : promedioPorcentaje,
        promedioNota: esFormativaAdaptativa
          ? null
          : porcentajeANota20(promedioPorcentaje),
        aprobados: esFormativaAdaptativa ? null : aprobados,
        reprobados: esFormativaAdaptativa ? null : reprobados,
        porcentajeAprobacion: esFormativaAdaptativa
          ? null
          : porcentajeAprobacion,
        estudiantesPorReforzar: esFormativaAdaptativa ? null : reprobados,
        resultadosPorVariante,
      },
      preguntasConMasErrores,
      temasConMasErrores,
      estudiantes,
    };
  },
};

module.exports = evaluacionesService;
