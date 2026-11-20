import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { importeARS } from "@/api/finanzas";
import { errorFinanciador, filasDe, rutaFinanciador } from "@/api/financiadores";
import { Button, Field, Input, Modal, Spinner } from "@/components/ui";
import SelectorBuscable from "@/components/ui/SelectorBuscable";

const ESTADOS = { cubierta: "Cobertura completa estimada", parcial: "Cobertura parcial estimada", no_cubierta: "No aplica cobertura", pendiente_evaluacion: "Pendiente de evaluación" };
const SALDOS = { pendiente: "Pendiente", parcial: "Pago parcial registrado", saldada: "Sin saldo pendiente", devolucion: "Saldo a devolver" };
const dinero = (valor) => valor == null ? "No determinado" : importeARS(valor);
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function Paginas({ consulta, pagina, cambiar }) {
  return <nav aria-label="Paginación de consulta" className="flex items-center justify-between gap-2">
    <Button type="button" variant="secondary" size="sm" disabled={pagina <= 1 || consulta.isFetching} onClick={() => cambiar(pagina - 1)}>Anterior</Button>
    <span className="text-sm">Página {pagina}</span>
    <Button type="button" variant="secondary" size="sm" disabled={!consulta.data?.next || consulta.isFetching} onClick={() => cambiar(pagina + 1)}>Siguiente</Button>
  </nav>;
}

function ErrorConsulta({ consulta }) {
  return <p role="alert">{errorFinanciador(consulta.error)} <Button variant="secondary" onClick={() => consulta.refetch()}>Reintentar</Button></p>;
}

export default function ConsultaPrestacionModal({ organizacion, persona, scope, cerrar }) {
  const [modo, setModo] = useState("simular");
  const [busqueda, setBusqueda] = useState("");
  const [termino, setTermino] = useState("");
  const [prestacion, setPrestacion] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [paginaPagos, setPaginaPagos] = useState(1);
  const [formulario, setFormulario] = useState({ prestacion: "", fecha: hoy(), cantidad: "1" });
  const [solicitud, setSolicitud] = useState(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setTermino(busqueda.trim()), 350);
    return () => clearTimeout(timer);
  }, [busqueda]);
  const catalogo = useQuery({
    queryKey: [...scope, "consulta-catalogo", termino, pagina], enabled: modo === "simular",
    queryFn: () => api.get(`${rutaFinanciador(organizacion.id, "aranceles")}?${new URLSearchParams({ search: termino, page: String(pagina) })}`), gcTime: 0, retry: false,
  });
  const simulacion = useQuery({
    queryKey: [...scope, "consulta-simulacion", persona.id, solicitud, intento], enabled: solicitud != null && modo === "simular",
    queryFn: () => api.post(rutaFinanciador(organizacion.id, "simular-prestacion"), { ...solicitud, afiliado: persona.id }),
    gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
  const pagos = useQuery({
    queryKey: [...scope, "consulta-pagos", persona.id, paginaPagos], enabled: modo === "pagos",
    queryFn: () => api.get(`${rutaFinanciador(organizacion.id, "ficha-afiliado")}?${new URLSearchParams({ afiliado: String(persona.id), estado: "realizada", pagos: "true", page: String(paginaPagos) })}`), gcTime: 0,
  });
  function cambiar(campo, valor) { setFormulario((f) => ({ ...f, [campo]: valor })); setSolicitud(null); }
  function elegirPrestacion(opcion) { setPrestacion(opcion); cambiar("prestacion", opcion?.id || ""); }
  function buscarPrestacion(texto) { setBusqueda(texto); setPagina(1); }
  const resultado = solicitud && simulacion.data;
  return createPortal(<Modal title="Consultar prestación y pago" width={860} onClose={cerrar}
    footer={<Button variant="secondary" onClick={cerrar}>Cerrar</Button>}>
    <div className="space-y-5">
      <div role="group" aria-label="Tipo de consulta" className="flex flex-wrap gap-2">
        <Button variant={modo === "simular" ? "primary" : "secondary"} aria-pressed={modo === "simular"} onClick={() => setModo("simular")}>Simular cobertura</Button>
        <Button variant={modo === "pagos" ? "primary" : "secondary"} aria-pressed={modo === "pagos"} onClick={() => setModo("pagos")}>Pagos registrados</Button>
      </div>
      {modo === "simular" ? <>
        <p className="text-sm text-texto-suave">Estimación con la afiliación y el plan actuales, las reglas conocidas y el consumo registrado. No reserva cupos, autoriza atenciones ni genera cargos o pagos.</p>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setIntento((i) => i + 1); setSolicitud({ prestacion: Number(formulario.prestacion), fecha: formulario.fecha, cantidad: Number(formulario.cantidad) }); }}>
            <SelectorBuscable label="Prestación y hospital" value={prestacion} onChange={elegirPrestacion}
              search={busqueda} onSearchChange={buscarPrestacion} placeholder="Buscar por prestación, código u hospital"
              options={filasDe(catalogo.data).map((p) => ({ id: p.id, label: `${p.prestacion} · ${p.hospital} · ${p.codigo}` }))}
              loading={catalogo.isFetching || busqueda.trim() !== termino} error={catalogo.error ? errorFinanciador(catalogo.error) : null}
              onRetry={() => catalogo.refetch()} page={pagina} hasNext={Boolean(catalogo.data?.next)}
              onPageChange={(numero) => { setPagina(numero); elegirPrestacion(null); }}
              emptyMessage="No hay prestaciones disponibles. Revisa la búsqueda o los convenios y servicios configurados." />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de la prestación"><Input type="date" required value={formulario.fecha} onChange={(e) => cambiar("fecha", e.target.value)} /></Field>
              <Field label="Cantidad"><Input type="number" min="1" max="100000" step="1" required value={formulario.cantidad} onChange={(e) => cambiar("cantidad", e.target.value)} /></Field>
            </div>
            <Button type="submit" disabled={!formulario.prestacion || simulacion.isFetching}>Simular</Button>
          </form>
        {solicitud && (simulacion.isFetching ? <Spinner label="Simulando cobertura…" /> : simulacion.error ? <ErrorConsulta consulta={simulacion} /> : resultado && <section aria-label="Resultado de simulación" className="space-y-4 rounded-lg border border-division p-4" aria-live="polite">
          <h3 className="font-semibold">{ESTADOS[resultado.estado] || "Resultado no determinado"}</h3>
          <dl className="grid gap-3 sm:grid-cols-3">{[["Total estimado", resultado.importe_total], ["Financiador estimado", resultado.importe_financiador], ["Paciente estimado", resultado.importe_paciente]].map(([nombre, valor]) => <div key={nombre}><dt className="text-sm text-texto-suave">{nombre}</dt><dd className="font-semibold">{dinero(valor)}</dd></div>)}</dl>
          <ul className="space-y-2 text-sm">{resultado.comprobaciones?.map((c) => <li key={c.codigo}><span className="font-semibold">{c.estado === "cumple" ? "Verificado" : c.estado === "pendiente" ? "Pendiente" : "No cumple"}: </span>{c.detalle}</li>)}</ul>
          <p className="text-sm text-texto-suave">La autorización, cuando se exige, se verifica para la atención concreta. Esta consulta no confirma un pago.</p>
        </section>)}
      </> : <>
        <p className="text-sm text-texto-suave">Saldos de las atenciones realizadas visibles para este financiador. Un acuerdo o ajuste puede saldar una cuenta sin que exista un pago.</p>
        {pagos.isFetching ? <Spinner label="Consultando pagos…" /> : pagos.error ? <ErrorConsulta consulta={pagos} /> : <>
          {!filasDe(pagos.data).length && <p role="status">No hay prestaciones realizadas visibles para esta afiliación.</p>}
          <div className="space-y-4">{filasDe(pagos.data).map((fila) => <section key={fila.id} className="space-y-3 rounded-lg border border-division p-4">
            <h3 className="font-semibold">{fila.prestacion} · {fila.hospital}</h3>
            <p className="text-sm text-texto-suave">{fila.fecha} · Atención #{fila.id} · Gestión del cargo: {fila.estado_cobro || "Sin informar"}</p>
            {!fila.pago_financiador?.cuentas?.length ? <p className="text-sm">Sin cargo del financiador registrado. No significa que esté pagado.</p> : fila.pago_financiador.cuentas.map((cuenta) => <div key={cuenta.id} className="space-y-2 border-t border-division pt-3">
              <p className="text-sm font-semibold">Cuenta #{cuenta.id} · {SALDOS[cuenta.estado] || "Estado no determinado"}</p>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">{[["Cargo original", cuenta.importe_original], ["Ajustes aprobados", cuenta.ajustes_aprobados], ["Obligación actual", cuenta.obligacion_actual], ["Pagos netos aprobados", cuenta.registrado_neto], ["Saldo pendiente", cuenta.pendiente], ["Saldo a devolver", cuenta.saldo_a_devolver], ["Pagos por aprobar", cuenta.por_aprobar], ["Reintegros por aprobar", cuenta.reintegros_por_aprobar], ["Ajustes por aprobar", cuenta.ajustes_por_aprobar]].map(([nombre, valor]) => <div key={nombre}><dt className="text-texto-suave">{nombre}</dt><dd className="font-medium">{dinero(valor)}</dd></div>)}</dl>
            </div>)}
          </section>)}</div>
          <Paginas consulta={pagos} pagina={paginaPagos} cambiar={setPaginaPagos} />
        </>}
      </>}
    </div>
  </Modal>, document.body);
}
