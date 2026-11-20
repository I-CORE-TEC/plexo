import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Field, Input } from "@/components/ui";
import { Icon } from "@/components/icons";

/** Selector presentacional: el consumidor conserva consulta, alcance y paginación. */
export default function SelectorBuscable({ label, value, onChange, search, onSearchChange,
  options, loading = false, error = null, onRetry, page = 1, hasNext = false, onPageChange,
  disabled = false, placeholder = "Buscar o seleccionar…", emptyMessage = "No hay coincidencias." }) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [posicion, setPosicion] = useState(null);
  const campo = useRef(null);
  const panel = useRef(null);
  const listaId = useId();
  const identidadOpciones = options.map((opcion) => opcion.id).join(":");
  const filas = loading || error ? [] : options;

  function cerrar() { setAbierto(false); setActivo(-1); onSearchChange(""); }
  function elegir(opcion) { onChange(opcion); cerrar(); campo.current?.focus(); }
  function paginar(numero) { setActivo(-1); onPageChange?.(numero); }

  useEffect(() => { setActivo(-1); }, [search, loading, identidadOpciones]);
  useEffect(() => {
    if (abierto && activo >= 0) document.getElementById(`${listaId}-${activo}`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo, listaId]);
  useEffect(() => {
    if (!abierto) return undefined;
    const salir = (event) => {
      if (!campo.current?.contains(event.target) && !panel.current?.contains(event.target)) {
        setAbierto(false); setActivo(-1); onSearchChange("");
      }
    };
    document.addEventListener("pointerdown", salir);
    return () => document.removeEventListener("pointerdown", salir);
  }, [abierto, onSearchChange]);
  useLayoutEffect(() => {
    if (!abierto || disabled) { setPosicion(null); return undefined; }
    const ubicar = () => {
      const caja = campo.current?.getBoundingClientRect();
      if (!caja || caja.bottom < 0 || caja.top > window.innerHeight) { setPosicion(null); return; }
      const abajo = window.innerHeight - caja.bottom - 12;
      const arriba = caja.top - 12;
      const altura = Math.min(panel.current?.scrollHeight || 240, 300);
      const invertir = abajo < altura && arriba > abajo;
      const maxHeight = Math.max(0, Math.min(300, invertir ? arriba : abajo));
      const width = Math.min(caja.width, window.innerWidth - 16);
      const nueva = { left: Math.max(8, Math.min(caja.left, window.innerWidth - width - 8)), width, maxHeight,
        top: invertir ? caja.top - Math.min(altura, maxHeight) - 4 : caja.bottom + 4 };
      setPosicion((anterior) => anterior && Object.keys(nueva).every((k) => anterior[k] === nueva[k]) ? anterior : nueva);
    };
    ubicar();
    const observador = new ResizeObserver(ubicar);
    if (campo.current) observador.observe(campo.current);
    if (panel.current) observador.observe(panel.current);
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    return () => { observador.disconnect(); window.removeEventListener("resize", ubicar); window.removeEventListener("scroll", ubicar, true); };
  }, [abierto, disabled]);

  return <div className="min-w-0" onBlur={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget) && !panel.current?.contains(e.relatedTarget)) cerrar();
  }}>
    <Field label={label}><div className="relative">
      <Input ref={campo} role="combobox" autoComplete="off" disabled={disabled} maxLength={160}
        value={value?.label || search} placeholder={placeholder} className="pr-9"
        aria-autocomplete="list" aria-expanded={abierto && !disabled}
        aria-controls={abierto && !disabled ? listaId : undefined} aria-describedby={`${listaId}-ayuda`}
        aria-activedescendant={abierto && activo >= 0 && filas[activo] ? `${listaId}-${activo}` : undefined}
        onChange={(e) => { onChange(null); onSearchChange(e.target.value); setActivo(-1); setAbierto(true); }}
        onFocus={(e) => e.target.select()} onClick={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && abierto) { e.preventDefault(); e.stopPropagation(); cerrar(); return; }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setAbierto(true);
            setActivo((i) => Math.max(0, Math.min(filas.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (abierto && filas[activo]) elegir(filas[activo]);
            else if (abierto && error) onRetry?.();
            else setAbierto(true);
          }
          if (abierto && !loading && onPageChange && (e.key === "PageDown" || e.key === "PageUp")) {
            e.preventDefault();
            if (e.key === "PageDown" && hasNext) paginar(page + 1);
            if (e.key === "PageUp" && page > 1) paginar(page - 1);
          }
        }} />
      <Icon name="chevronRight" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-texto-debil" />
    </div></Field>
    <span id={`${listaId}-ayuda`} className="sr-only">Escribe para buscar. Usa las flechas y Enter para seleccionar. Escape cierra los resultados. Avance y retroceso de página cambian la página de resultados. Ante un error, Enter reintenta.</span>
    {abierto && !disabled && createPortal(<div ref={panel} data-selector-panel
      style={{ position: "fixed", zIndex: 100, ...posicion, visibility: posicion ? "visible" : "hidden" }}
      className="overflow-y-auto rounded-md border border-borde bg-superficie shadow-dropdown"
      onMouseDown={(e) => e.preventDefault()}>
      {loading ? <p role="status" className="p-3 text-sm text-texto-debil">Buscando…</p>
        : error ? <div role="alert" className="p-3 text-sm"><p>{error}</p><Button type="button" tabIndex={-1} size="sm" variant="ghost" onClick={onRetry}>Reintentar búsqueda</Button></div>
          : !filas.length ? <p role="status" className="p-3 text-sm text-texto-debil">{emptyMessage}</p> : null}
      <div id={listaId} role="listbox" aria-label={label} aria-busy={loading}>
        {filas.map((opcion, i) => <div id={`${listaId}-${i}`} key={opcion.id} role="option" aria-selected={value?.id === opcion.id}
          onClick={() => elegir(opcion)} onMouseMove={() => setActivo(i)}
          className={`cursor-pointer break-words px-3 py-2.5 text-sm hover:bg-superficie-2 ${i === activo ? "bg-superficie-2" : ""}`}>
          {opcion.label}
        </div>)}
      </div>
      {!loading && !error && onPageChange && (page > 1 || hasNext) && <div className="flex items-center justify-between gap-2 border-t border-division p-2">
        <Button type="button" tabIndex={-1} size="sm" variant="ghost" disabled={page <= 1} onClick={() => paginar(page - 1)}>Anterior</Button>
        <span className="text-xs text-texto-suave">Página {page}</span>
        <Button type="button" tabIndex={-1} size="sm" variant="ghost" disabled={!hasNext} onClick={() => paginar(page + 1)}>Siguiente</Button>
      </div>}
    </div>, document.body)}
  </div>;
}
