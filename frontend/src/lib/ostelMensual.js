// Padrón OSTEL del mes (#219): el backend clasifica cada fila en un grupo
// (contrato 4) y la UI aplica cada grupo con un único motivo por lote.
export const CONTRATO_MENSUAL = 4;

// `accion` sólo existe en los grupos que se aplican; los conflictos se revisan.
export const GRUPOS = Object.freeze([
  { key: "alta", label: "Altas", accion: "Aplicar altas" },
  { key: "modificacion", label: "Modificaciones", accion: "Aplicar modificaciones" },
  { key: "baja", label: "Bajas", accion: "Aplicar bajas" },
  { key: "reingreso", label: "Reingresos", accion: "Aplicar reingresos" },
  { key: "conflicto", label: "Conflictos" },
]);

export const esMensual = (lote) => lote?.resumen?.contrato === CONTRATO_MENSUAL;

// Una fila en revisión sin grupo es un conflicto; las excluidas no cuentan
// (igual que `resumen.grupos` en el backend).
export const grupoDe = (fila) => fila.grupo || (fila.estado === "revision" ? "conflicto" : null);
export const filasDelGrupo = (filas, grupo) => filas.filter((f) => f.estado !== "omitida" && grupoDe(f) === grupo);
export const pendientesDe = (lote, grupo) => Number(lote?.resumen?.pendientes?.[grupo] || 0);

export const MOTIVO_MAXIMO = 255;
export const motivoValido = (motivo) => {
  const texto = String(motivo || "").trim();
  return texto.length > 0 && texto.length <= MOTIVO_MAXIMO;
};

const CAMPOS = {
  numero_interno: "Número interno", numero: "Número de afiliación", documento: "Documento", cuil: "CUIL", nombre: "Nombre completo",
  calle: "Calle", altura: "Altura", piso: "Piso", departamento: "Departamento", codigo_postal: "Código postal",
  localidad: "Localidad", provincia: "Provincia", telefono: "Teléfono", celular: "Celular", email: "Email",
  sexo: "Sexo", fecha_nacimiento: "Fecha de nacimiento",
};
export const etiquetaCampo = (campo) => CAMPOS[campo] || campo;

// Repite tandas de hasta 100 filas mientras el grupo tenga pendientes. Nunca
// es infinito: corta sin pendientes, sin progreso, al desmontar o con error.
export async function aplicarGrupo(lote, grupo, enviar, alActualizar = () => {}, seguir = () => true) {
  let actual = lote;
  while (seguir() && pendientesDe(actual, grupo) > 0) {
    const nuevo = await enviar(grupo);
    if (!seguir()) return nuevo;
    alActualizar(nuevo);
    const avanzo = pendientesDe(nuevo, grupo) < pendientesDe(actual, grupo);
    actual = nuevo;
    if (!avanzo) break;
  }
  return actual;
}
