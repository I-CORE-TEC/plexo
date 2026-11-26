"""Proyecciones de consulta: no crean atención, deuda ni habilitaciones."""
from collections import defaultdict
from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP
from types import SimpleNamespace

from django.utils import timezone

from apps.finanzas.models import ObligacionFinanciera
from apps.finanzas.saldos import saldos_obligaciones
from .cobertura import arancel_aplicable, cantidades_periodo, periodo, regla_aplicable
from .models import ConfiguracionHospital, DistribucionCobro, ResolucionSaldo
from .vigencias import convenio_aplicable, tiene_cobertura


def simular_afiliado(*, afiliado, vinculo, fecha, cantidad):
    """Estado y plan actuales, reglas conocidas hoy y fecha de prestación elegida.

    La autorización clínica no se presume sin una atención concreta. No se
    construye ni persiste un Caso y no se emite una firma utilizable para reservar.
    """
    corte = timezone.now()
    prestacion, comun = vinculo.prestacion, vinculo.comun
    comprobaciones = []

    def comprobar(codigo, estado, detalle):
        comprobaciones.append({"codigo": codigo, "estado": estado, "detalle": detalle})

    resultado = {"simulacion": True, "afiliado": afiliado.pk, "fecha": str(fecha),
                 "cantidad": cantidad, "estado": "no_cubierta", "comprobaciones": comprobaciones,
                 "consultado_en": corte.isoformat(), "cubiertas": 0, "porcentaje": "0.00",
                 "disponibles": None, "importe_total": None, "importe_financiador": None,
                 "importe_paciente": None}
    vigente = tiene_cobertura(afiliado, fecha)[0]
    comprobar("afiliacion", "cumple" if vigente else "no_cumple",
              "Afiliación habilitada para la fecha indicada." if vigente else
              "La afiliación actual no está habilitada, aún no inició o está finalizada.")
    plan_activo = not afiliado.plan_id or afiliado.plan.activo
    comprobar("plan", "cumple" if plan_activo else "no_cumple",
              afiliado.plan.nombre if afiliado.plan_id else "Sin plan específico: se consultan reglas generales.")
    servicio_activo = bool(prestacion.activo and prestacion.nodo_id and comun.activo
                           and ConfiguracionHospital.objects.filter(institucion=prestacion.institucion, activo=True).exists())
    comprobar("servicio", "cumple" if servicio_activo else "no_cumple",
              "Prestación y circuito hospitalario activos." if servicio_activo else "Prestación o circuito hospitalario inactivo.")
    instante = corte if fecha == timezone.localdate(corte) else timezone.make_aware(datetime.combine(fecha, time.min))
    convenio = convenio_aplicable(afiliado.financiador_id, prestacion.institucion_id, instante)
    comprobar("convenio", "cumple" if convenio else "no_cumple",
              "Convenio vigente en la fecha consultada." if convenio else "Sin convenio vigente en la fecha consultada.")
    if not all((vigente, plan_activo, servicio_activo, convenio)):
        return resultado

    proyeccion = SimpleNamespace(afiliado=afiliado, plan_id=afiliado.plan_id)
    regla = regla_aplicable(proyeccion, comun, fecha, corte)
    porcentaje = regla.porcentaje if regla else convenio.porcentaje_default or Decimal(0)
    comprobar("regla", "cumple" if porcentaje > 0 else "no_cumple",
              f"Cobertura configurada: {porcentaje}%." + (" Regla general del convenio." if not regla else ""))
    inicio, fin = periodo(fecha, regla.periodo if regla else "anio")
    usados = cantidades_periodo(afiliado, comun, inicio, fin)
    disponibles = max(0, regla.cupo - usados) if regla and regla.cupo is not None else None
    cubiertas = min(cantidad, disponibles if disponibles is not None else cantidad) if porcentaje > 0 else 0
    comprobar("cupo", "cumple" if cubiertas == cantidad else "no_cumple",
              f"{cubiertas} de {cantidad} unidades cubiertas según el consumo registrado.")
    resultado.update(porcentaje=str(porcentaje), disponibles=disponibles, cubiertas=cubiertas,
                     estado="cubierta" if cubiertas == cantidad and porcentaje == 100 else "parcial" if cubiertas else "no_cubierta")
    politica, _, arancel = arancel_aplicable(prestacion=prestacion, convenio=convenio, fecha=fecha, corte=corte)
    if not politica or (politica.cobrar and arancel is None):
        comprobar("arancel", "pendiente", "Falta política de cobro o arancel para estimar los importes.")
        resultado["estado"] = "pendiente_evaluacion"
    else:
        total = (arancel * cantidad if politica.cobrar else Decimal(0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if total > Decimal("999999999999.99"):
            comprobar("arancel", "pendiente", "El total supera el máximo admitido por Finanzas.")
            resultado["estado"] = "pendiente_evaluacion"
        else:
            importe = (arancel * cubiertas * porcentaje / 100 if politica.cobrar else Decimal(0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            resultado.update(importe_total=f"{total:.2f}", importe_financiador=f"{importe:.2f}", importe_paciente=f"{total-importe:.2f}")
            comprobar("arancel", "cumple", "Importes estimados; no son cargos ni pagos." if politica.cobrar else "El hospital no cobra esta prestación.")
    requiere = bool(regla and regla.requiere_autorizacion)
    comprobar("autorizacion", "pendiente" if requiere else "cumple",
              "Requiere autorización previa: debe verificarse para la atención concreta." if requiere else "La regla no exige autorización previa.")
    if requiere:
        resultado["estado"] = "pendiente_evaluacion"
    return resultado


def pagos_por_reserva(reservas):
    """Enriquece sólo una página ya autorizada; nunca compensa cuentas distintas."""
    ids = [r.pk for r in reservas if r.estado == "realizada"]
    enlaces = list(DistribucionCobro.objects.filter(reserva_id__in=ids, obligacion_financiador__isnull=False)
                   .values_list("reserva_id", "obligacion_financiador_id"))
    enlaces += list(ResolucionSaldo.objects.filter(distribucion__reserva_id__in=ids, decision="financiador", obligacion__isnull=False)
                    .values_list("distribucion__reserva_id", "obligacion_id"))
    campos = ("importe_original", "ajustes_aprobados", "obligacion_actual", "registrado_neto",
              "pendiente", "saldo_a_devolver", "por_aprobar", "reintegros_por_aprobar", "ajustes_por_aprobar")
    cuentas = {}
    for cuenta in saldos_obligaciones(ObligacionFinanciera.objects.filter(pk__in={c for _, c in enlaces}, tipo="cobrar")):
        estado = "devolucion" if cuenta.saldo_a_devolver > 0 else (
            "parcial" if cuenta.pendiente > 0 and cuenta.registrado_neto > 0 else "pendiente" if cuenta.pendiente > 0 else "saldada")
        cuentas[cuenta.pk] = {"id": cuenta.pk, "estado": estado, **{campo: f"{getattr(cuenta, campo):.2f}" for campo in campos}}
    resultado = defaultdict(list)
    for reserva, cuenta in sorted(set(enlaces)):
        if cuenta in cuentas:
            resultado[reserva].append(cuentas[cuenta])
    return {r.pk: {"cuentas": resultado[r.pk], "estado": "registrado" if resultado[r.pk] else "sin_cargo_registrado"}
            for r in reservas}
