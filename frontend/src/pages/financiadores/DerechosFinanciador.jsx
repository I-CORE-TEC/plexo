import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import { errorFinanciador, filasDe, opcionesFinanciador, rutaFinanciador } from "@/api/financiadores";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import { derechoAfiliacionPadron } from "@/components/financiadores/padronTablaEstado";
import { parseRightsNavigation, updateRightsNavigation } from "@/lib/derechosNavigation";
import NovedadesFinanciador from "./NovedadesFinanciador";

const ETIQUETAS_DERECHO = {
  vigentes: "Vigente",
  administrativas: "Deshabilitada administrativamente",
  futuras: "Futura",
  finalizadas: "Finalizada",
};

function identidadAfiliado(fila) {
  return fila?.id ?? fila?.afiliado ?? fila?.numero ?? null;
}

export default function DerechosFinanciador({ organizacion, usuarioId, operador, afiliadoFijo = null }) {
  const [parametros, setParametros] = useSearchParams();
  const contexto = new URLSearchParams(parametros);
  if (afiliadoFijo != null) contexto.set("afiliado", String(afiliadoFijo));
  const navegacion = parseRightsNavigation(contexto);
  const [busqueda, setBusqueda] = useState(parametros.get("buscar") || "");
  const afiliadoId = navegacion.affiliateId;
  const textoBusqueda = parametros.get("buscar") || "";
  const paginaSolicitada = Number(parametros.get("padron_page") || 1);
  const pagina = Number.isSafeInteger(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : 1;
  const scope = ["financiadores", usuarioId, organizacion.id];
  const consulta = useQuery({
    queryKey: [...scope, "derechos-personas", textoBusqueda, pagina],
    enabled: afiliadoFijo == null && textoBusqueda.trim().length > 0,
    queryFn: () => {
      const query = new URLSearchParams({ estado: "todos", page: String(pagina), page_size: "10", search: textoBusqueda.trim() });
      return api.get(`${rutaFinanciador(organizacion.id, "padron")}?${query}`);
    },
    gcTime: 0,
  });
  const ficha = useQuery({
    queryKey: [...scope, "derechos-ficha", afiliadoId],
    enabled: afiliadoId != null && !navegacion.invalid,
    queryFn: () => api.get(`${rutaFinanciador(organizacion.id, "ficha-afiliado")}?${new URLSearchParams({ afiliado: String(afiliadoId), page: "1", page_size: "10" })}`),
    gcTime: 0,
    retry: false,
  });
  const planes = useQuery({
    queryKey: [...scope, "opciones-planes"],
    queryFn: () => opcionesFinanciador(organizacion.id, "planes"),
    enabled: afiliadoId != null,
    gcTime: 0,
    retry: false,
  });
  const resultado = useMemo(() => filasDe(consulta.data), [consulta.data]);
  const persona = ficha.data?.afiliado;
  const identidadFicha = identidadAfiliado(persona);
  const personaExacta = persona && String(identidadFicha) === String(afiliadoId) ? persona : null;
  const planId = personaExacta?.plan ?? personaExacta?.plan_id;
  const nombrePlan = planes.data?.find((plan) => String(plan.id) === String(planId))?.nombre || (planId ? `Plan ${planId}` : "Sin plan asignado");
  const clasificacion = personaExacta ? derechoAfiliacionPadron(personaExacta) : null;

  useEffect(() => setBusqueda(textoBusqueda), [textoBusqueda]);

  function actualizar(cambios, opciones) {
    setParametros(updateRightsNavigation(parametros, cambios), opciones);
  }

  function buscar(event) {
    event.preventDefault();
    const siguiente = new URLSearchParams(parametros);
    siguiente.set("buscar", busqueda.trim());
    siguiente.delete("padron_page");
    siguiente.delete("afiliado");
    siguiente.delete("novedad");
    siguiente.delete("estado");
    siguiente.delete("page");
    setParametros(siguiente);
  }

  function seleccionar(id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) return;
    actualizar({ affiliateId: Number(id), noveltyId: null, status: "", page: 1 });
  }

  function cambiarPagina(delta) {
    const siguiente = Math.max(1, pagina + delta);
    const query = new URLSearchParams(parametros);
    if (siguiente === 1) query.delete("padron_page");
    else query.set("padron_page", String(siguiente));
    setParametros(query);
  }

  return <section aria-label="Derechos por persona" className="space-y-5">
    <header className="space-y-2">
      <h2 className="text-cifra font-bold">Derechos por persona</h2>
      <p className="text-sm text-texto-suave">Revisá la situación y la evidencia administrativa de esta afiliación. Conciliar evidencia y cambiar la habilitación son decisiones separadas.</p>
      <Link className="text-sm font-semibold text-accent hover:underline" to={`/financiadores/borradores?financiador=${organizacion.id}`}>Borradores de derechos (no operativo)</Link>
    </header>

    {afiliadoFijo == null && <Card className="space-y-4 p-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={buscar}>
        <div className="min-w-[min(100%,20rem)] flex-1"><Field label="Buscar persona por documento, número o nombre">
          <Input id="derechos-busqueda" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} autoComplete="off" />
        </Field></div>
        <Button type="submit">Buscar persona</Button>
      </form>
      {(navegacion.invalid || (navegacion.noveltyId != null && afiliadoId == null)) && <p role="alert">El enlace no identifica una afiliación válida para mostrar evidencia. Seleccioná una persona desde la búsqueda.</p>}
      {textoBusqueda && <>
        {consulta.isFetching ? <Spinner label="Buscando afiliaciones…" /> : consulta.error ? <p role="alert">{errorFinanciador(consulta.error)}</p> : resultado.length ? <>
          <p className="text-sm text-texto-suave">Resultados administrativos, vigentes, futuros y finalizados · {consulta.data?.count ?? resultado.length} coincidencias</p>
          <ul aria-label="Personas encontradas" className="divide-y divide-division">
            {resultado.map((fila) => {
              const id = identidadAfiliado(fila);
              if (id == null) return null;
              return <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="font-semibold">{[fila.apellido, fila.nombre].filter(Boolean).join(", ") || fila.nombre_completo || `Afiliado #${id}`}</p><p className="text-sm text-texto-suave">Afiliado #{id} · {fila.documento || "Sin documento informado"}</p></div>
                <Button variant="secondary" onClick={() => seleccionar(id)}>Seleccionar afiliado #{id}</Button>
              </li>;
            })}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={pagina <= 1 || consulta.isFetching} onClick={() => cambiarPagina(-1)}>Anterior</Button>
            <span className="text-sm text-texto-suave">Página {pagina}</span>
            <Button variant="secondary" disabled={!consulta.data?.next || consulta.isFetching} onClick={() => cambiarPagina(1)}>Siguiente</Button>
          </div>
        </> : <p role="status">No se encontraron personas con esos datos.</p>}
      </>}
    </Card>}

    {afiliadoId != null && <>
      {ficha.isLoading ? <Spinner label="Consultando afiliación…" /> : ficha.error ? <p role="alert">{errorFinanciador(ficha.error)}</p> : !personaExacta ? <p role="alert">No se pudo confirmar la identidad de esta afiliación. Volvé a buscar y seleccioná una persona.</p> : <section aria-label="Situación de afiliación"><Card className="space-y-3 p-4">
        <div><h2 className="font-semibold">Situación de afiliación</h2><p>{[personaExacta.apellido, personaExacta.nombre].filter(Boolean).join(", ") || personaExacta.nombre_completo || `Afiliado #${afiliadoId}`} · Afiliado #{afiliadoId}</p></div>
        <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-texto-suave">Clasificación</dt><dd>{ETIQUETAS_DERECHO[clasificacion] || "No clasificada"}</dd></div><div><dt className="text-sm text-texto-suave">Plan</dt><dd>{planes.isLoading ? "Consultando…" : nombrePlan}</dd></div><div><dt className="text-sm text-texto-suave">Cobertura habilitada</dt><dd>{personaExacta.cobertura_habilitada === true ? "Habilitada" : personaExacta.cobertura_habilitada === false ? "Deshabilitada" : "No registrado"}</dd></div></dl>
        {planes.error && <p role="status">No se pudo consultar el nombre del plan. La afiliación mantiene su identificador registrado.</p>}
        <p className="text-sm text-texto-suave">La clasificación y la habilitación no garantizan una prestación ni un pago. También aplican fechas, plan, convenio, reglas del servicio, cupos y autorización.</p>
        <div className="flex flex-wrap gap-3">{afiliadoFijo == null && <Link className="font-semibold text-accent hover:underline" to={`/financiadores/padron/${afiliadoId}?financiador=${organizacion.id}`}>Ver ficha actual</Link>}<Link className="font-semibold text-accent hover:underline" to={`/financiadores/reglas?financiador=${organizacion.id}`}>Ver reglas de cobertura</Link>{planId && <Link className="font-semibold text-accent hover:underline" to={`/financiadores/planes?financiador=${organizacion.id}`}>Ver plan</Link>}</div>
      </Card></section>}
      {afiliadoFijo == null && <div className="flex justify-end"><Button variant="secondary" onClick={() => actualizar({ affiliateId: null, noveltyId: null, status: "", page: 1 })}>Limpiar persona seleccionada</Button></div>}
      {!ficha.isLoading && !ficha.error && personaExacta && <NovedadesFinanciador key={`${organizacion.id}:${afiliadoId}`} organizacion={organizacion} scope={scope} operador={operador} personaFija={afiliadoFijo == null ? null : { ...personaExacta, id: afiliadoId }} />}
    </>}
  </section>;
}
