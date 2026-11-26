// Padrón OSTEL del mes (#219). La vista previa agrupa las filas en altas,
// modificaciones, bajas, reingresos y conflictos; cada grupo se aplica con un
// único motivo del lote. Sólo los conflictos se revisan fila por fila.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { errorFinanciador, opcionesFinanciador, rutaFinanciador } from "@/api/financiadores";
import { Ayuda, Button, Checkbox, Field, Input } from "@/components/ui";
import { fechaCalendario, plural } from "@/lib/format";
import { GRUPOS, MOTIVO_MAXIMO, aplicarGrupo, esMensual, etiquetaCampo, grupoDe, motivoValido, pendientesDe } from "@/lib/ostelMensual";
import { BotonArchivoAnotado, PasoPreparar, PasoRevisar, PestanasFilas, TablaFilas, pestanaInicial } from "./ImportacionPasos";
import RevisionFilaOstel, { fichaInicial } from "./RevisionFilaOstel";
import FamiliaFilaOstel from "./FamiliaFilaOstel";

const ESTADOS = { valida: "Pendiente de aplicar", revision: "Requiere revisión", aplicada: "Aplicada", omitida: "Excluida" };
const DESCRIPCIONES = {
  alta: "Personas nuevas en el padrón. Se registran con la cobertura elegida al cargar.",
  modificacion: "Personas existentes con datos distintos. Cada fila muestra el valor anterior y el nuevo.",
  baja: "Sólo filas con FECBAJ o ESTADO=B. FECBAJ es la fecha de corte: la afiliación termina ese día. La ausencia en el archivo no genera bajas y FECVTO nunca es baja.",
  reingreso: "Afiliaciones finalizadas que vuelven en el archivo. Se reactivan con su plan anterior desde FECING.",
  conflicto: "Identidad, duplicados o fechas inconsistentes. Revisá cada fila: corregila o excluila del lote.",
};
const PESTANAS = [
  ...GRUPOS.map((g) => ({ key: g.key, label: g.label, incluye: (f) => f.estado !== "omitida" && grupoDe(f) === g.key })),
  { key: "omitida", label: "Excluidas", incluye: (f) => f.estado === "omitida" },
];
const pendiente = (f) => !["aplicada", "omitida"].includes(f.estado);
// Fechas ISO del archivo (AAAA-MM-DD) se muestran como DD/MM/AAAA.
const valor = (v) => v == null || v === "" ? "Sin informar"
  : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v).split("-").reverse().join("/") : String(v);

function Diferencias({ fila }) {
  if (!fila.diferencias?.length) return <p className="text-texto-debil">Sin cambios de datos.</p>;
  return <table className="mt-1 w-full min-w-[18rem] text-left text-xs" aria-label={`Cambios de la fila ${fila.fila_excel ?? fila.fila}`}>
    <thead><tr><th scope="col" className="pr-2">Campo</th><th scope="col" className="pr-2">Antes</th><th scope="col">Después</th></tr></thead>
    <tbody>{fila.diferencias.map((d) => <tr key={d.campo} className="border-t border-division align-top">
      <th scope="row" className="py-1 pr-2 font-medium">{etiquetaCampo(d.campo)}</th>
      <td className="py-1 pr-2 text-texto-debil">{valor(d.anterior)}</td>
      <td className="py-1">{valor(d.nuevo)}</td>
    </tr>)}</tbody>
  </table>;
}

export default function ImportacionAdministrativa({ organizacion, scope, formato, lote, setLote, lotes, onAplicado, onBloqueosChange, soloDetalle = false, coberturaHabilitada = true }) {
  const [archivo, setArchivo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [edicion, setEdicion] = useState(null);
  const [familia, setFamilia] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [confirmaBajas, setConfirmaBajas] = useState(false);
  const [filtro, setFiltro] = useState(() => pestanaInicial(PESTANAS, lote?.filas || []));
  const clave = useRef(crypto.randomUUID());
  useEffect(() => { clave.current = crypto.randomUUID(); }, [coberturaHabilitada]);
  const activo = useRef(true);
  useEffect(() => { activo.current = true; return () => { activo.current = false; }; }, []);
  useEffect(() => { onBloqueosChange({ selector: ocupado || !!edicion || !!familia, cierre: ocupado || !!edicion || !!familia }); }, [ocupado, edicion, familia, onBloqueosChange]);
  useEffect(() => { setEdicion(null); setError(null); setAviso(null); setConfirmaBajas(false); setFiltro(pestanaInicial(PESTANAS, lote?.filas || [])); }, [lote?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ruta = (recurso) => rutaFinanciador(organizacion.id, recurso);
  const mensual = esMensual(lote);
  const hayReingresos = mensual && (lote?.filas || []).some((f) => f.grupo === "reingreso");
  const planes = useQuery({ queryKey: [...(scope || ["financiadores", organizacion.id]), "opciones-planes"],
    queryFn: () => opcionesFinanciador(organizacion.id, "planes"), enabled: hayReingresos, gcTime: 0, retry: false });
  const nombrePlan = (id) => planes.data?.find((p) => p.id === id)?.nombre || (id ? `plan ${id}` : "sin plan registrado");

  async function ejecutar(accion) {
    setOcupado(true); setError(null);
    try { await accion(); }
    catch (e) { if (activo.current) setError(errorFinanciador(e)); }
    finally { if (activo.current) setOcupado(false); }
  }
  async function revisar(event) {
    event.preventDefault();
    if (!archivo || ocupado) return;
    await ejecutar(async () => {
      const datos = new FormData();
      datos.append("archivo", archivo); datos.append("clave", clave.current); datos.append("cobertura_habilitada", String(coberturaHabilitada));
      const nuevo = await api.multipart(ruta(formato.recursoRevision), datos);
      if (activo.current) { setLote(nuevo); lotes.refetch(); }
    });
  }
  async function aplicar(grupo) {
    const { label } = GRUPOS.find((g) => g.key === grupo);
    setAviso(null);
    await ejecutar(async () => {
      try {
        const final = await aplicarGrupo(lote, grupo,
          (g) => api.post(ruta("aplicar-ostel"), { importacion: lote.id, grupos: [g], motivo: motivo.trim(), confirmar_bajas: g === "baja" && confirmaBajas }),
          (nuevo) => setLote(nuevo), () => activo.current);
        if (!activo.current) return;
        if (grupo === "baja") setConfirmaBajas(false);
        const quedan = pendientesDe(final, grupo);
        if (quedan > 0) setAviso(`Quedan ${plural(quedan, "fila", "filas")} sin aplicar en ${label}. Reintentá; lo ya aplicado no se repite.`);
      } finally {
        // Aun con error, lo aplicado en tandas previas ya cambió el padrón.
        if (activo.current) { lotes.refetch(); await onAplicado(); }
      }
    });
  }
  async function guardar(accion) {
    await ejecutar(async () => {
      const nuevo = await api.post(ruta("subsanar-ostel"), {
        importacion: lote.id, fila: edicion.fila, revision: edicion.revision,
        datos: edicion.datos, motivo: edicion.motivo, accion,
        ...(accion === "corregir" && !edicion.bloqueo_fuente ? { ficha: edicion.ficha } : {}),
      });
      if (activo.current) {
        setLote(nuevo);
        const fila = nuevo.filas.find((f) => f.fila === edicion.fila);
        if (fila?.errores.some((e) => e.includes("no se guardó la corrección"))) {
          setEdicion({ ...fila, datos: edicion.datos, ficha: edicion.ficha, motivo: edicion.motivo });
          setError(fila.errores.join(" "));
        } else setEdicion(null);
        lotes.refetch();
      }
    });
  }
  const abrir = (f, lectura) => { setError(null); setEdicion({ ...f, datos: { ...f.datos }, ficha: fichaInicial(f), motivo: "", lectura }); };
  const bloqueado = ocupado || !!edicion || !!familia;

  function detalle(f) {
    const grupo = grupoDe(f);
    return <div className="space-y-1">
      <div className="flex items-center gap-1.5"><span>{ESTADOS[f.estado] || f.estado}</span>{f.advertencias?.length > 0 && <Ayuda align="right" etiqueta={`Advertencias de la fila ${f.fila_excel}`}>{f.advertencias.map((a) => <span key={a} className="block">{a}</span>)}</Ayuda>}</div>
      {mensual && grupo === "modificacion" && <Diferencias fila={f} />}
      {mensual && grupo === "baja" && f.fecha_baja && <p>Baja el {fechaCalendario(f.fecha_baja)}. La afiliación termina ese día.</p>}
      {mensual && grupo === "reingreso" && f.fecha_ingreso && <p>Reingresa el {fechaCalendario(f.fecha_ingreso)} con su plan anterior: {nombrePlan(f.plan_anterior)}.</p>}
      {f.errores?.length > 0 && <ul className="list-disc pl-4 text-badge-error-fg">{f.errores.map((e) => <li key={e}>{e}</li>)}</ul>}
    </div>;
  }
  function accion(f, soloLectura) {
    const lectura = soloLectura || !pendiente(f);
    return <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" className="whitespace-nowrap" disabled={bloqueado} onClick={() => abrir(f, lectura)}>{lectura ? "Ver detalle" : "Revisar fila"}</Button>
      {/* Conservar el disparador enfocable para que Modal pueda devolverle el foco. */}
      {!soloLectura && f.estado === "aplicada" && f.afiliado && <Button variant="secondary" size="sm" className="whitespace-nowrap" disabled={ocupado || !!edicion || (!!familia && familia.fila !== f.fila)} onClick={() => { if (!familia) setFamilia(f); }}>Vincular familia</Button>}
    </div>;
  }
  const persona = (f) => <>{f.datos.nombre || "Sin nombre"}<br /><span className="text-texto-debil">CUIL {f.datos.cuil || "sin informar"} · interno {f.datos.numero_interno || "sin informar"}</span></>;

  const pestana = PESTANAS.find((p) => p.key === filtro) || PESTANAS[0];
  const grupoActual = GRUPOS.find((g) => g.key === pestana.key);
  const filas = (lote?.filas || []).filter(pestana.incluye);
  const pendientes = grupoActual?.accion ? pendientesDe(lote, grupoActual.key) : 0;
  const esBaja = grupoActual?.key === "baja";
  const pestanas = PESTANAS.filter((p) => p.key !== "omitida" || (lote?.filas || []).some(p.incluye));
  return <div className="space-y-5">
    {!soloDetalle && <>
      <h3 className="text-lg font-semibold">Importar padrón OSTEL del mes</h3>
      <PasoPreparar deshabilitado={ocupado} ayuda={<>{formato.descripcion} Las ausencias no generan bajas. Una baja sólo sale de FECBAJ o ESTADO=B, con FECBAJ como fecha de corte.</>}
        onDescargar={() => ejecutar(() => api.download(`${ruta("plantilla")}?${new URLSearchParams(formato.parametrosPlantilla("padron"))}`, formato.nombrePlantilla("padron")))} />
      <PasoRevisar onSubmit={revisar} enviable={!!archivo} ocupado={ocupado && !lote} deshabilitado={ocupado || !!edicion}
        ayuda="Hasta 5 MiB. Conservá identificadores y ceros tal como fueron informados."
        onArchivo={(nuevo) => { setArchivo(nuevo); setLote(null); setError(null); clave.current = crypto.randomUUID(); }} />
    </>}
    {error && !edicion && <p role="alert" className="rounded-md bg-badge-error-bg p-3 text-badge-error-fg">{error}</p>}
    {/* Archivo rechazado entero: la copia marca las celdas que lo impidieron. */}
    {!soloDetalle && archivo && !lote && error && <BotonArchivoAnotado organizacion={organizacion} archivo={archivo} deshabilitado={ocupado} onError={(e) => e && setError(errorFinanciador(e))} />}
    {lote && !mensual && <section className="space-y-4 border-t border-division pt-5" aria-label="Revisión administrativa">
      <p role="status" className="rounded-md bg-badge-amber-bg p-3 text-sm">Este lote se preparó antes de los grupos mensuales. Cargá el archivo nuevamente.</p>
      <div className="overflow-x-auto"><TablaFilas key={lote.id} filas={lote.filas || []} persona={persona} detalle={detalle} accion={(f) => accion(f, true)} /></div>
    </section>}
    {lote && mensual && <section className="space-y-4 border-t border-division pt-5" aria-label="Revisión administrativa">
      <p role="status">{lote.resumen.cobertura_habilitada === true ? "Personas nuevas: cobertura habilitada, sujeta a plan, fechas y reglas." : "Personas nuevas: sólo registro administrativo, sin habilitar cobertura."} En personas existentes se conserva la habilitación actual.</p>
      <h3 className="font-semibold">3. Revisá y aplicá cada grupo</h3>
      <div className="w-full max-w-[36rem]">
        <Field label="Motivo del lote" ayuda={`Obligatorio para aplicar. Queda registrado en cada cambio. Hasta ${MOTIVO_MAXIMO} caracteres.`}>
          <Input value={motivo} maxLength={MOTIVO_MAXIMO} required disabled={ocupado} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      </div>
      {!soloDetalle && archivo && (lote.resumen.revision > 0 || lote.resumen.advertencias > 0) && <BotonArchivoAnotado organizacion={organizacion} archivo={archivo} importacion={lote.id} deshabilitado={bloqueado} onError={(e) => setError(e && errorFinanciador(e))} />}
      {aviso && <p role="status" className="text-sm text-badge-amber-fg">{aviso}</p>}
      <PestanasFilas pestanas={pestanas} filas={lote.filas} valor={pestana.key} onChange={(key) => { setFiltro(key); setConfirmaBajas(false); }} />
      <div role="tabpanel" aria-label={pestana.label} className="space-y-3">
        <p className="text-sm text-texto-debil">{DESCRIPCIONES[pestana.key] || "Filas excluidas del lote. No se aplican."}</p>
        {grupoActual?.accion && <div className="flex flex-wrap items-center gap-3">
          {esBaja && pendientes > 0 && <Checkbox checked={confirmaBajas} disabled={ocupado} onChange={(e) => setConfirmaBajas(e.target.checked)}
            label={`Confirmo aplicar ${plural(pendientes, "baja", "bajas")} con su FECBAJ`} />}
          <Button disabled={bloqueado || pendientes === 0 || !motivoValido(motivo) || (esBaja && !confirmaBajas)} onClick={() => aplicar(grupoActual.key)}>
            {ocupado ? "Aplicando…" : `${grupoActual.accion} (${pendientes})`}</Button>
          {pendientes > 0 && !motivoValido(motivo) && <span className="text-sm text-texto-debil">Completá el motivo del lote para aplicar.</span>}
        </div>}
        <div className="overflow-x-auto"><TablaFilas key={`${lote.id}:${pestana.key}`} filas={filas} persona={persona} detalle={detalle} accion={(f) => accion(f, false)} /></div>
      </div>
      {edicion && <RevisionFilaOstel edicion={edicion} setEdicion={setEdicion} ocupado={ocupado} error={error}
        onGuardar={guardar} onCerrar={() => { setEdicion(null); setError(null); }} />}
      {familia && <FamiliaFilaOstel key={`${lote.id}:${familia.fila}`} organizacion={organizacion} lote={lote} fila={familia}
        onCerrar={() => setFamilia(null)} onAplicado={onAplicado} />}
    </section>}
    {lote && !mensual && edicion && <RevisionFilaOstel edicion={edicion} setEdicion={setEdicion} ocupado={ocupado} error={error}
      onGuardar={guardar} onCerrar={() => { setEdicion(null); setError(null); }} />}
  </div>;
}
