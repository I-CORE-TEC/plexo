"""Padrón vigente para Admisión; no elige cobertura ni acepta cargos del caso."""
from collections import defaultdict

from apps.registros.models import DOCUMENTOS_NN, normalizar_documento

from .models import ConfiguracionHospital
from .vigencias import afiliados_vigentes, convenios_vigentes, tiene_cobertura

MOTIVOS_NO_SELECCIONABLE = {
    "sin_cobertura": "Registro sólo administrativo, sin habilitación de cobertura.",
    "plan_inactivo": "El plan está inactivo. Revisá el padrón con el financiador.",
}
NO_VIGENTE = "La afiliación no está vigente para una nueva selección. Los casos anteriores conservan su afiliación."


def _motivo_no_seleccionable(afiliado):
    """Empty when selectable; the query already keeps only covered affiliates,
    so the coverage branch guards the shared rule, not a reachable state today."""
    cubierto, motivo = tiene_cobertura(afiliado)
    if not cubierto:
        return MOTIVOS_NO_SELECCIONABLE.get(motivo, NO_VIGENTE)
    if afiliado.plan_id and not afiliado.plan.activo:
        return MOTIVOS_NO_SELECCIONABLE["plan_inactivo"]
    return ""


def resumenes_administrativos(ciudadanos):
    """Recibe ciudadanos previamente autorizados. Consulta por lote, sin escribir."""
    ciudadanos = list(ciudadanos)
    habilitados = set(ConfiguracionHospital.objects.filter(
        institucion_id__in={c.institucion_id for c in ciudadanos}, activo=True,
    ).values_list("institucion_id", flat=True))
    convenios = defaultdict(set)
    for hospital, financiador in convenios_vigentes().filter(
        institucion_id__in=habilitados, financiador__activo=True,
    ).values_list("institucion_id", "financiador_id"):
        convenios[hospital].add(financiador)
    documentos = {
        normalizar_documento(c.documento) for c in ciudadanos
        if c.institucion_id in habilitados and c.documento
    } - {""} - DOCUMENTOS_NN
    por_documento = defaultdict(list)
    financiadores = set().union(*convenios.values()) if convenios else set()
    for afiliado in afiliados_vigentes().filter(
        documento__in=documentos, financiador_id__in=financiadores,
    ).select_related("financiador", "plan").order_by("financiador__nombre", "pk"):
        por_documento[afiliado.documento].append(afiliado)

    resultado = {}
    for ciudadano in ciudadanos:
        habilitada = ciudadano.institucion_id in habilitados
        documento = normalizar_documento(ciudadano.documento or "")
        if documento in DOCUMENTOS_NN:
            documento = ""
        afiliaciones = []
        for afiliado in por_documento.get(documento, []):
            if afiliado.financiador_id not in convenios[ciudadano.institucion_id]:
                continue
            motivo = _motivo_no_seleccionable(afiliado)
            afiliaciones.append({
                "id": afiliado.pk,
                "financiador_id": afiliado.financiador_id,
                "financiador_nombre": afiliado.financiador.nombre,
                "plan_id": afiliado.plan_id,
                "plan_nombre": afiliado.plan.nombre if afiliado.plan_id else "",
                "numero": afiliado.numero, "desde": afiliado.desde.isoformat(),
                "seleccionable": not motivo,
                "motivo": motivo,
            })
        estado = "sin_padron"
        if not habilitada:
            estado = "no_habilitada"
        elif not documento:
            estado = "sin_documento"
        elif afiliaciones:
            estado = "multiple" if len(afiliaciones) > 1 else "vigente"
        resultado[ciudadano.pk] = {
            "habilitada": habilitada, "estado": estado,
            "declaracion_legada": ciudadano.obra_social,
            "afiliaciones": afiliaciones,
        }
    return resultado
