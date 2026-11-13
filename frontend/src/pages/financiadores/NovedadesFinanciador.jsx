import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import { errorFinanciador, filasDe, rutaFinanciador } from "@/api/financiadores";
import { Button, Card, Checkbox, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { buildRightsAffiliateUrl, parseRightsNavigation, updateRightsNavigation } from "@/lib/derechosNavigation";

const ESTADOS = { pendiente: "Pendiente", conciliada: "Conciliada", descartada: "Descartada" };
const CONFLICTOS = { padron_modificado: "El padrón cambió desde el registro de la propuesta.", referencia_repetida: "La fuente y referencia coinciden con otra propuesta. No se eligió una ganadora." };
const AVISO = "Registrar o conciliar evidencia no modifica el padrón, la vigencia ni los derechos.";

function estadoDecision(novedad) {
  const decision = novedad.habilitacion_cobertura;
  if (decision === undefined) return "Consultar decisión en el detalle";
  if (!decision) return "Sin decisión registrada";
  return `${decision.resultado === "cambiada" ? "Aplicada" : "Sin cambios"} · ${decision.cobertura_habilitada ? "Habilitada" : "Deshabilitada"}`;
}

function siguientePaso(novedad, operador) {
  if (novedad.habilitacion_cobertura) return "La decisión ya está registrada. Consulta el historial y la ficha para conocer la situación actual; no se aplica otra decisión sobre esta novedad.";
  if (!operador) return "Puedes consultar la evidencia y el historial. Las decisiones corresponden a un operador autorizado.";
  if (novedad.rectificaciones?.length) return "Esta novedad fue rectificada. Revisa la propuesta posterior; este antecedente no permite decidir cobertura.";
  if (novedad.estado === "descartada") return "La propuesta está descartada y no permite decidir cobertura. Si hay evidencia nueva, registra una rectificación sin borrar el antecedente.";
  if (novedad.estado === "pendiente") return "Revisa la evidencia y las diferencias antes de conciliar o descartar con un motivo. Conciliar no obliga a cambiar la cobertura.";
  if (novedad.conflictos.length) return `${novedad.conflictos.map((c) => CONFLICTOS[c] || c).join(" ")} Revisa la ficha y las propuestas relacionadas. Confirmar un conflicto al conciliar no lo elimina ni habilita una decisión de cobertura.`;
  return "Puedes registrar una decisión explícita de cobertura si cuentas con respaldo suficiente. Si falta un criterio confirmado, conserva la novedad sin decisión; no deduzcas el resultado de fechas o códigos.";
}

function vacia() {
  return { clave: crypto.randomUUID(), afiliado: "", fuente: "", referencia: "", codigo: "",
    fecha_informada: "", descripcion: "", motivo: "", rectifica: null };
}

function borradorDetalleVacio(identidad) {
  return { identidad, motivo: "", confirmar: false, valorCobertura: "", motivoCobertura: "", error: null };
}

export default function NovedadesFinanciador({ organizacion, scope, operador, personaFija = null }) {
  const qc = useQueryClient();
  const [parametros, setParametros] = useSearchParams();
  const contexto = new URLSearchParams(parametros);
  if (personaFija) contexto.set("afiliado", String(personaFija.id));
  const navegacion = parseRightsNavigation(contexto);
  const { status: estado, page: pagina, noveltyId: seleccion, affiliateId: afiliado } = navegacion;
  const identidadDetalle = JSON.stringify([organizacion.id, afiliado, seleccion]);
  const [formulario, setFormulario] = useState(null);
  const [personaInicial, setPersonaInicial] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const [borradorDetalle, setBorradorDetalle] = useState(() => borradorDetalleVacio(identidadDetalle));
  const valoresDetalle = borradorDetalle.identidad === identidadDetalle
    ? borradorDetalle
    : borradorDetalleVacio(identidadDetalle);
  useLayoutEffect(() => {
    setBorradorDetalle((actual) => actual.identidad === identidadDetalle
      ? actual
      : borradorDetalleVacio(identidadDetalle));
  }, [identidadDetalle]);
  const base = rutaFinanciador(organizacion.id, "novedades");
  const clave = [...scope, "novedades"];
  const parametrosConsulta = new URLSearchParams({ page: String(pagina) });
  if (estado) parametrosConsulta.set("estado", estado);
  if (afiliado != null) parametrosConsulta.set("afiliado", String(afiliado));
  const listado = useQuery({ queryKey: [...clave, afiliado, estado, pagina], enabled: !navegacion.invalid, gcTime: 0,
    queryFn: () => api.get(`${base}?${parametrosConsulta}`) });
  const detalle = useQuery({ queryKey: [...clave, "detalle", seleccion], enabled: seleccion != null && !navegacion.invalid,
    gcTime: 0, queryFn: () => api.get(`${base}${seleccion}/`) });
  const novedadAjen = detalle.data && afiliado != null && Number(detalle.data.original?.afiliado) !== afiliado;
  const novedad = novedadAjen ? null : detalle.data;
  const coberturaBloqueada = novedad && (novedad.conflictos.length > 0 || novedad.rectificaciones?.length > 0);

  function cambiarNavegacion(cambios, opciones) {
    setParametros(updateRightsNavigation(contexto, personaFija ? { ...cambios, affiliateId: personaFija.id } : cambios), opciones);
  }

  function actualizarBorradorDetalle(cambios) {
    setBorradorDetalle((actual) => actual.identidad === identidadDetalle
      ? { ...actual, ...cambios }
      : actual);
  }
  function limpiarBorradorDetalle() {
    setBorradorDetalle((actual) => actual.identidad === identidadDetalle
      ? borradorDetalleVacio(identidadDetalle)
      : actual);
  }
  function abrir(id) { cambiarNavegacion({ noveltyId: id }); setErrorFormulario(null); }
  function nueva(antecedente = null) {
    setPersonaInicial(antecedente?.persona_actual || personaFija);
    setFormulario(antecedente ? { ...antecedente.original, clave: crypto.randomUUID(),
      rectifica: antecedente.id, motivo: "" } : { ...vacia(), afiliado: personaFija?.id ?? "" });
    cambiarNavegacion({ noveltyId: null }); setErrorFormulario(null);
  }
  async function guardar(event) {
    event.preventDefault(); setOcupado(true); setErrorFormulario(null);
    try {
      const resultado = await api.post(base, { ...formulario, afiliado: Number(personaFija?.id ?? formulario.afiliado),
        fecha_informada: formulario.fecha_informada || null });
      qc.setQueryData([...clave, "detalle", resultado.id], resultado);
      setFormulario(null); abrir(resultado.id);
      await qc.invalidateQueries({ queryKey: clave });
    } catch (e) { setErrorFormulario(e); } finally { setOcupado(false); }
  }
  async function decidir(accion) {
    setOcupado(true); actualizarBorradorDetalle({ error: null });
    try {
      const resultado = await api.post(`${base}${novedad.id}/resolver/`, {
        accion, motivo: valoresDetalle.motivo, revision: novedad.revision, revision_padron: novedad.persona_actual.revision,
        confirmar_conflictos: valoresDetalle.confirmar,
      });
      qc.setQueryData([...clave, "detalle", resultado.id], resultado);
      limpiarBorradorDetalle();
      await qc.invalidateQueries({ queryKey: clave });
    } catch (e) { actualizarBorradorDetalle({ error: e }); } finally { setOcupado(false); }
  }
  async function decidirHabilitacion() {
    setOcupado(true); actualizarBorradorDetalle({ error: null });
    try {
      const resultado = await api.post(`${base}${novedad.id}/habilitacion-cobertura/`, {
        cobertura_habilitada: valoresDetalle.valorCobertura === "habilitar",
        motivo: valoresDetalle.motivoCobertura,
        revision: novedad.revision,
        revision_padron: novedad.persona_actual.revision,
      });
      qc.setQueryData([...clave, "detalle", resultado.id], resultado);
      limpiarBorradorDetalle();
      await Promise.all([
        qc.invalidateQueries({ queryKey: clave }),
        qc.invalidateQueries({ queryKey: ["financiadores", scope[1], organizacion.id, "derechos-ficha"] }),
        qc.invalidateQueries({ queryKey: ["financiador", scope[1], organizacion.id] }),
      ]);
    } catch (e) { actualizarBorradorDetalle({ error: e }); } finally { setOcupado(false); }
  }
  async function actualizar() {
    actualizarBorradorDetalle({ confirmar: false, error: null });
    await detalle.refetch();
  }
  const cerrar = () => { cambiarNavegacion({ noveltyId: null }); };
  const limpiarContexto = () => cambiarNavegacion({ affiliateId: null, noveltyId: null, status: null, page: null });
  const fichaActual = novedad && buildRightsAffiliateUrl({ financierId: organizacion.id,
    affiliateId: novedad.persona_actual.id });
  const historialActual = novedad && buildRightsAffiliateUrl({ financierId: organizacion.id,
    affiliateId: novedad.persona_actual.id, tab: "historial" });

  return <div className="space-y-4">
    <p role="note" className="rounded-lg border border-division bg-superficie-2 p-4 text-sm">{AVISO}</p>
    <details className="rounded-lg border border-division p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Gestión manual de novedades</summary>
      <p className="mt-2">Registra evidencia, revisa diferencias y concilia o descarta la propuesta. Un operador autorizado puede decidir la habilitación de cobertura con motivo e historial, cuando corresponda.</p>
      <p className="mt-2">Las fechas y causales no generan cambios automáticos. Las bajas, reingresos, gracia, mora, cambios de plan y efectos en familias, atención o dinero requieren reglas validadas. Las reglas automáticas de OSTEL siguen pendientes de validación.</p>
    </details>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <Field label="Estado de la novedad"><Select value={estado} onChange={(e) => cambiarNavegacion({ status: e.target.value, page: null, noveltyId: null })}>
        <option value="">Todos</option>{Object.entries(ESTADOS).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
      </Select></Field>
      {operador && <Button onClick={() => nueva()}>Registrar novedad</Button>}
    </div>
    {afiliado != null && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-superficie-2 px-3 py-2 text-sm">
      <span>Mostrando novedades de la persona #{afiliado}</span>
      {!personaFija && <Button variant="ghost" size="sm" onClick={limpiarContexto}>Quitar filtro de persona</Button>}
    </div>}
    {navegacion.invalid && <p role="alert" className="rounded-md bg-badge-error-bg p-3 text-sm text-badge-error-fg">El enlace contiene un identificador inválido. Limpiá el enlace antes de continuar. <Button variant="ghost" onClick={limpiarContexto}>Limpiar enlace</Button></p>}
    {navegacion.invalid ? null : listado.isPending ? <Spinner /> : listado.error ? <p role="alert">{errorFinanciador(listado.error)} <Button variant="secondary" onClick={() => listado.refetch()}>Reintentar</Button></p> : <>
      {!filasDe(listado.data).length && <Card><p className="text-sm text-texto-suave">No hay novedades en este estado.</p></Card>}
      <ul aria-label="Novedades registradas" className="space-y-3">{filasDe(listado.data).map((item) => <li key={item.id}>
        <Card><div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 break-words"><p className="font-semibold">{item.original.fuente} · {item.original.referencia || "Sin referencia externa"}</p>
            <p className="mt-1 text-sm text-texto-suave">#{item.id} · Evidencia: {ESTADOS[item.estado]} · {item.original.codigo || "Sin código informado"}</p>
            <p className="mt-1 text-sm">Decisión registrada: <span>{estadoDecision(item)}</span></p></div>
          <Button variant="secondary" onClick={() => abrir(item.id)} aria-label={`Ver novedad ${item.id}`}>Ver detalle</Button>
        </div></Card>
      </li>)}</ul>
      <nav aria-label="Paginación de novedades" className="flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={!listado.data?.previous} onClick={() => cambiarNavegacion({ page: pagina - 1 })}>Anterior</Button>
        <span className="text-sm">Página {pagina} · {listado.data?.count || 0} novedades</span>
        <Button variant="secondary" disabled={!listado.data?.next} onClick={() => cambiarNavegacion({ page: pagina + 1 })}>Siguiente</Button>
      </nav>
    </>}
    {formulario && operador && createPortal(<FormularioNovedad formulario={formulario} cambiar={setFormulario}
      personaInicial={personaInicial} personaFija={personaFija} basePadron={rutaFinanciador(organizacion.id, "padron")}
      scope={scope} ocupado={ocupado} error={errorFormulario} guardar={guardar} cerrar={() => setFormulario(null)} />, document.body)}
    {seleccion != null && createPortal(<Modal title={`Novedad #${seleccion}`} width={860}
      onClose={ocupado ? undefined : cerrar} footer={<Button variant="secondary" disabled={ocupado} onClick={cerrar}>Cerrar</Button>}>
      {navegacion.invalid ? <p role="alert">El identificador de la novedad no es válido.</p> : novedadAjen ? <p role="alert">La novedad no corresponde a la persona seleccionada. No se muestra la evidencia. <Button variant="ghost" onClick={cerrar}>Limpiar selección</Button></p> : detalle.isPending ? <Spinner /> : detalle.error ? <p role="alert">{errorFinanciador(detalle.error)} <Button onClick={actualizar}>Reintentar</Button></p> : novedad && <div className="space-y-4">
        <p className="font-semibold">Evidencia: {ESTADOS[novedad.estado]}</p>
        <p className="text-sm">Decisión registrada: {estadoDecision(novedad)}</p><p className="text-sm">{AVISO}</p>
        <section aria-label="Siguiente paso" className="rounded-lg bg-superficie-2 p-4 text-sm">
          <h2 className="font-semibold">Siguiente paso</h2><p className="mt-1">{siguientePaso(novedad, operador)}</p>
          {novedad.rectificaciones?.map((id) => <Button key={id} variant="ghost" onClick={() => abrir(id)}>Revisar rectificación #{id}</Button>)}
          {coberturaBloqueada && !novedad.habilitacion_cobertura && <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link className="font-medium text-accent hover:underline" to={fichaActual}>Revisar ficha actual</Link>
            {novedad.estado === "conciliada" && <Button variant="secondary" disabled={ocupado} onClick={actualizar}>Actualizar comparación</Button>}
          </div>}
        </section>
        <section aria-label="Evidencia original" className="rounded-lg border border-division p-4">
          <h2 className="mb-2 font-semibold">Evidencia original</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">{[["Fuente", novedad.original.fuente], ["Referencia", novedad.original.referencia],
            ["Código informado", novedad.original.codigo], ["Fecha informada (sin efecto automático)", novedad.original.fecha_informada],
            ["Rectifica propuesta", novedad.original.rectifica]].map(([etiqueta, valor]) => <div key={etiqueta} className="min-w-0 break-words"><dt className="text-texto-suave">{etiqueta}</dt><dd>{valor || "Sin informar"}</dd></div>)}</dl>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm">{novedad.original.descripcion}</p>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">{[["Al registrar", novedad.persona_inicial], ["Padrón actual", novedad.persona_actual]].map(([titulo, persona]) => <section key={titulo} className="rounded-lg bg-superficie-2 p-3 text-sm">
          <h2 className="font-semibold">{titulo}</h2><p>{persona.nombre}</p><p>Documento: {persona.documento}</p><p>Revisión: {persona.revision} · {persona.finalizada ? "Afiliación finalizada" : "Afiliación no finalizada"}</p><p>Cobertura: {persona.cobertura_habilitada === true ? "Habilitada" : persona.cobertura_habilitada === false ? "Deshabilitada · sólo registro administrativo" : "No registrado"}</p>
        </section>)}</div>
        {novedad.conflictos.length > 0 && <div role="status" className="rounded-lg bg-badge-amber-bg p-3 text-sm text-badge-amber-fg">
          <h2 className="font-semibold">Revisión de conflictos</h2><ul className="mt-2 list-inside list-disc">{novedad.conflictos.map((c) => <li key={c}>{CONFLICTOS[c] || c}</li>)}</ul>
          {novedad.coincidencias.length > 0 && <p>Propuestas relacionadas: {novedad.coincidencias.map((id) => `#${id}`).join(", ")}</p>}
        </div>}
        <section aria-label="Historial de la propuesta"><h2 className="font-semibold">Historial de decisiones</h2>
          <ol className="mt-2 space-y-2">{novedad.historia.map((h, i) => <li key={i} className="rounded-lg border border-division p-3 text-sm">
            <p className="font-semibold">{h.accion === "registrar" ? "Registro" : h.accion === "conciliar" ? "Conciliación sin aplicación" : "Descarte"} · Usuario {h.usuario}</p>
            <p className="text-texto-suave">{new Date(h.fecha).toLocaleString("es-AR")}</p><p className="mt-1 whitespace-pre-wrap break-words">{h.motivo}</p>
          </li>)}</ol>
        </section>
        {valoresDetalle.error && <p role="alert" className="text-badge-error-fg">{errorFinanciador(valoresDetalle.error)}</p>}
        {novedad.habilitacion_cobertura && <section aria-label="Decisión de cobertura" className="rounded-lg border border-division p-4 text-sm">
          <h2 className="font-semibold">Decisión explícita de cobertura</h2>
          <p className="mt-1">{novedad.habilitacion_cobertura.resultado === "cambiada" ? "Cobertura actualizada" : "Sin cambios: ya tenía el valor elegido"} · {novedad.habilitacion_cobertura.cobertura_habilitada ? "Habilitada" : "Deshabilitada"}</p>
          <p className="mt-1 text-texto-suave">{novedad.habilitacion_cobertura.motivo}</p>
          {novedad.habilitacion_cobertura.historial_id && <p className="mt-1">Cambio enlazado al historial del padrón #{novedad.habilitacion_cobertura.historial_id}.</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><Link className="font-medium text-accent hover:underline" to={fichaActual}>Ver ficha actual</Link><Link className="font-medium text-accent hover:underline" to={historialActual}>Ver historial</Link></div>
        </section>}
        {operador && novedad.estado === "pendiente" && <section className="space-y-3 border-t border-division pt-4">
          <Field label="Motivo de la decisión"><Textarea value={valoresDetalle.motivo} maxLength={255} disabled={ocupado} onChange={(e) => actualizarBorradorDetalle({ motivo: e.target.value })} /></Field>
          {novedad.conflictos.length > 0 && <Checkbox label="Revisé expresamente los conflictos y coincidencias indicados" checked={valoresDetalle.confirmar} disabled={ocupado} onChange={(e) => actualizarBorradorDetalle({ confirmar: e.target.checked })} />}
          <div className="flex flex-wrap gap-2"><Button disabled={ocupado || !valoresDetalle.motivo.trim() || novedad.conflictos.length > 0 && !valoresDetalle.confirmar} onClick={() => decidir("conciliar")}>Conciliar sin aplicar efectos</Button>
            <Button variant="secondary" disabled={ocupado || !valoresDetalle.motivo.trim()} onClick={() => decidir("descartar")}>Descartar propuesta</Button>
            <Button variant="ghost" disabled={ocupado} onClick={actualizar}>Actualizar comparación</Button></div>
        </section>}
        {operador && novedad.estado === "conciliada" && !novedad.habilitacion_cobertura && !coberturaBloqueada && <section aria-label="Decisión explícita de cobertura" className="space-y-3 border-t border-division pt-4">
          <h2 className="font-semibold">Decisión de cobertura</h2>
          <p className="text-sm text-texto-suave">Elegí el estado de forma explícita. No se infiere del código o la fecha de la novedad. Habilitar no reactiva una afiliación finalizada ni garantiza una prestación.</p>
          <Field label="Estado de cobertura"><Select value={valoresDetalle.valorCobertura} disabled={ocupado} onChange={(e) => actualizarBorradorDetalle({ valorCobertura: e.target.value })}>
            <option value="">Elegir estado</option><option value="habilitar">Habilitar cobertura</option><option value="deshabilitar">Deshabilitar cobertura</option>
          </Select></Field>
          <Field label="Motivo de la decisión"><Textarea value={valoresDetalle.motivoCobertura} maxLength={255} disabled={ocupado} onChange={(e) => actualizarBorradorDetalle({ motivoCobertura: e.target.value })} /></Field>
          <Button disabled={ocupado || !valoresDetalle.valorCobertura || !valoresDetalle.motivoCobertura.trim()} onClick={decidirHabilitacion}>Aplicar decisión de cobertura</Button>
        </section>}
        {operador && <Button variant="secondary" disabled={ocupado} onClick={() => nueva(novedad)}>Registrar rectificación</Button>}
      </div>}
    </Modal>, document.body)}
  </div>;
}

function FormularioNovedad({ formulario, cambiar, personaInicial, personaFija, basePadron, scope, ocupado, error, guardar, cerrar }) {
  const [busqueda, setBusqueda] = useState(personaInicial?.documento || "");
  const personas = useQuery({ queryKey: [...scope, "novedades-personas", busqueda],
    enabled: !personaFija && busqueda.trim().length >= 2, gcTime: 0,
    queryFn: () => api.get(`${basePadron}?search=${encodeURIComponent(busqueda.trim())}&page_size=20`) });
  const opciones = [...filasDe(personas.data)];
  if (personaInicial && !opciones.some((p) => p.id === personaInicial.id)) opciones.unshift(personaInicial);
  const campo = (nombre) => ({ value: formulario[nombre] ?? "", disabled: ocupado,
    onChange: (e) => cambiar({ ...formulario, [nombre]: e.target.value }) });
  return <Modal title={formulario.rectifica ? `Rectificar novedad #${formulario.rectifica}` : "Registrar novedad"} width={760}
    onClose={ocupado ? undefined : cerrar} footer={<><Button variant="secondary" disabled={ocupado} onClick={cerrar}>Cancelar</Button><Button type="submit" form="formulario-novedad" disabled={ocupado}>Guardar propuesta</Button></>}>
    <form id="formulario-novedad" onSubmit={guardar} className="space-y-4">
      <p className="text-sm">{AVISO} Los datos originales se conservan; una rectificación crea otra propuesta.</p>
      {error && <p role="alert" className="text-badge-error-fg">{errorFinanciador(error)}</p>}
      <Field label="Buscar persona por documento o nombre"><Input value={busqueda} maxLength={160} disabled={ocupado || Boolean(personaFija) || formulario.rectifica != null} onChange={(e) => setBusqueda(e.target.value)} /></Field>
      {personas.error && <p role="alert">{errorFinanciador(personas.error)}</p>}
      <Field label="Persona del padrón"><Select {...campo("afiliado")} required disabled={ocupado || Boolean(personaFija) || formulario.rectifica != null}>
        <option value="">Seleccionar persona</option>{opciones.map((p) => <option key={p.id} value={p.id}>{p.documento} · {p.nombre}</option>)}
      </Select></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fuente"><Input {...campo("fuente")} maxLength={80} required /></Field>
        <Field label="Referencia externa"><Input {...campo("referencia")} maxLength={120} /></Field>
        <Field label="Código informado"><Input {...campo("codigo")} maxLength={80} /></Field>
        <Field label="Fecha informada"><Input {...campo("fecha_informada")} type="date" /></Field>
      </div>
      <Field label="Descripción administrativa" hint="No incluir datos clínicos ni interpretar esta evidencia como una orden de baja o reingreso."><Textarea {...campo("descripcion")} maxLength={2000} required /></Field>
      <Field label="Motivo del registro"><Textarea {...campo("motivo")} maxLength={255} required /></Field>
    </form>
  </Modal>;
}
