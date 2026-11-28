"""Remove an explicit subset of fictitious records, never a whole demo."""
import re

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.core.files.utils import validate_file_name
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, OperationalError, connection, transaction
from django.db.models import Q
from django.utils import timezone

from apps.auditoria.models import AccesoClinico
from apps.casos.models import Caso
from apps.demo import archivos
from apps.demo.entorno import exigir_entorno_de_prueba
from apps.financiadores import models as m
from apps.financiadores.autorizaciones import accesos_solicitudes
from apps.financiadores.services import auditar


REQUEST_CHILDREN = (m.EventoAutorizacion, m.UsoAutorizacion, m.PrescripcionAutorizacion)
AFFILIATE_CHILDREN = (
    m.VinculoCiudadano, m.HistorialAfiliacion, m.DocumentoLegajo, m.SaludPadron,
    m.CobranzaPadron, m.HistorialPadronProtegido,
)
DELETE_ORDER = (
    *REQUEST_CHILDREN, m.SolicitudAutorizacion, *AFFILIATE_CHILDREN, m.Afiliado, m.Importacion,
)
ALLOWED_EDGES = {
    *((child, "solicitud") for child in REQUEST_CHILDREN),
    *((child, "afiliado") for child in AFFILIATE_CHILDREN),
    (m.SolicitudAutorizacion, "anterior"), (m.SolicitudAutorizacion, "afiliado"),
    (m.HistorialAfiliacion, "lote"), (m.Afiliado, "titular"),
}
ATTACHMENT_FIELDS = {
    "adjunto_ruta": "", "adjunto_nombre": "", "adjunto_content_type": "", "adjunto_sha256": "",
    "adjunto_tamano": None, "adjunto_subido_por_id": None, "adjunto_fecha": None,
}


def _document_filter(ranges):
    query = Q(pk__in=[])
    for value in ranges:
        match = re.fullmatch(r"([0-9]{1,80})-([0-9]{1,80})", value)
        if not match or len(match[1]) != len(match[2]) or match[1] > match[2]:
            raise CommandError("--afiliados-documento requiere DESDE-HASTA de igual longitud y en orden.")
        query |= Q(documento__range=match.groups(), documento__regex=rf"^[0-9]{{{len(match[1])}}}$")
    return query


def _ids(value):
    if not value:
        return set()
    parts = value.split(",")
    if any(not re.fullmatch(r"[0-9]{1,19}", part) or not 0 < int(part) < 2**63 for part in parts):
        raise CommandError("Se requieren identificadores positivos separados por comas.")
    return {int(part) for part in parts}


def _selected(model, ids):
    return model._base_manager.filter(pk__in=ids)


def _reverse_fields(model):
    return (
        relation.field for relation in model._meta.get_fields(include_hidden=True)
        if relation.auto_created and not relation.concrete and (relation.one_to_many or relation.one_to_one)
    )


def _lock_apply_tables():
    if connection.vendor != "postgresql":
        return
    # Prevent inserts/updates between preflight and Django's deletion collector, even
    # for new CASCADE/SET_NULL relations. Fail promptly if another write is in progress.
    models = {m.Financiador, m.RegistroFactura, AccesoClinico, Caso, *DELETE_ORDER}
    models.update(field.model for model in DELETE_ORDER for field in _reverse_fields(model))
    tables = ", ".join(connection.ops.quote_name(table)
                       for table in sorted({model._meta.db_table for model in models}))
    with connection.cursor() as cursor:
        cursor.execute(f"LOCK TABLE {tables} IN SHARE ROW EXCLUSIVE MODE NOWAIT")


def _blockers(plan):
    for model, ids in plan.items():
        if not ids:
            continue
        for field in _reverse_fields(model):
            child = field.model
            references = child._base_manager.filter(**{
                f"{field.attname}__in": _selected(model, ids).values(field.target_field.attname),
            })
            if (child, field.name) in ALLOWED_EDGES:
                references = references.exclude(pk__in=plan[child])
            count = references.count()
            if count:
                yield f"{model.__name__} ← {child.__name__}.{field.name}: {count}"


def _leaf_batches(model, ids, parent_field):
    remaining = dict(_selected(model, ids).values_list("pk", parent_field))
    while remaining:
        leaves = remaining.keys() - set(remaining.values())
        if not leaves:
            raise CommandError(f"Ciclo de dependencias en {model.__name__}.{parent_field}.")
        for pk in leaves:
            del remaining[pk]
        yield leaves


def _authorization_blockers(requests, ids):
    # These operational references do not all have a foreign key to the request.
    reservations = m.ReservaCobertura.objects.filter(
        Q(uso_autorizacion__solicitud_id__in=ids) | Q(evaluacion__autorizacion__in=ids),
    ).exclude(estado="liberada", uso_autorizacion__estado="liberado")
    # A released snapshot with no remaining usage is historical, not operational.
    count = reservations.exclude(estado="liberada", uso_autorizacion__isnull=True).count()
    if count:
        yield f"SolicitudAutorizacion ← ReservaCobertura no liberada o con uso no liberado: {count}"
    waiting_cases = {
        request.caso_id for request in requests
        if request.caso_id and request.caso.estado not in Caso.ESTADOS_FINALIZADOS
        and request.pk in request.caso.espera_autorizacion.get("solicitudes", [])
    }
    if waiting_cases:
        yield f"SolicitudAutorizacion ← Caso.espera_autorizacion: {len(waiting_cases)}"


def _clinical_access_count(plan, requests):
    linked = _selected(m.VinculoCiudadano, plan[m.VinculoCiudadano])
    patient_ids = set(linked.values_list("ciudadano_id", flat=True))
    patient_ids.update(access["ciudadano"].pk for access in
                       accesos_solicitudes(requests)
                       if access["ciudadano"] is not None)
    return AccesoClinico.objects.filter(
        Q(ciudadano_id__in=patient_ids)
        | Q(recurso="solicitudautorizacion", objeto_id__in=map(str, plan[m.SolicitudAutorizacion]))
        | Q(recurso="prescripcionautorizacion", objeto_id__in=map(str, plan[m.PrescripcionAutorizacion]))
    ).count()


class Command(BaseCommand):
    help = "Previsualiza o limpia registros ficticios de un financiador sin resembrar la demo."

    def add_arguments(self, parser):
        parser.add_argument("--financiador", required=True, type=int, help="ID del financiador.")
        parser.add_argument("--afiliados-documento", action="append", default=[], metavar="DESDE-HASTA",
                            help="Rango inclusivo de documentos numéricos de igual longitud; repetible.")
        parser.add_argument("--importaciones", metavar="ID[,ID]", help="IDs de importación.")
        parser.add_argument("--solicitudes", metavar="ID[,ID]", help="Números internos (IDs) de solicitud.")
        parser.add_argument("--adjunto-factura", metavar="NUMERO", help="Quita el adjunto, no la factura.")
        parser.add_argument("--permitir-accesos-clinicos", action="store_true",
                            help="Confirma la limpieza si hay accesos clínicos; nunca borra su auditoría.")
        parser.add_argument("--aplicar", action="store_true", help="Ejecuta el plan (por defecto solo simula).")

    def handle(self, *args, **options):
        exigir_entorno_de_prueba("limpiar_demo")
        if not settings.SEED_DEMO:
            raise CommandError("limpiar_demo requiere SEED_DEMO habilitado.")
        if not any(options[key] for key in ("afiliados_documento", "importaciones", "solicitudes", "adjunto_factura")):
            raise CommandError("Indicá al menos un selector de limpieza.")
        try:
            with transaction.atomic():
                if options["aplicar"]:
                    _lock_apply_tables()
                self._run(options)
        except IntegrityError as error:
            raise CommandError("La base rechazó el plan; se revirtieron todos los cambios.") from error
        except OperationalError as error:
            raise CommandError("No se pudo completar la transacción; revisá la conexión o las escrituras activas.") from error

    def _run(self, options):
        funder = m.Financiador.objects.filter(pk=options["financiador"]).first()
        if funder is None:
            raise CommandError("No existe el financiador indicado.")
        scope = {"financiador": funder}
        plan = {
            m.Afiliado: set(m.Afiliado.objects.filter(
                _document_filter(options["afiliados_documento"]), **scope,
            ).values_list("pk", flat=True)),
        }
        for model, option in ((m.SolicitudAutorizacion, "solicitudes"), (m.Importacion, "importaciones")):
            ids = _ids(options[option])
            missing = ids - set(_selected(model, ids).filter(**scope).values_list("pk", flat=True))
            if missing:
                raise CommandError(f"{model.__name__}: IDs fuera del financiador o inexistentes: {sorted(missing)}.")
            plan[model] = ids
        for parent, foreign_key, children in (
            (m.SolicitudAutorizacion, "solicitud_id", REQUEST_CHILDREN),
            (m.Afiliado, "afiliado_id", AFFILIATE_CHILDREN),
        ):
            for child in children:
                plan[child] = set(child.objects.filter(**{f"{foreign_key}__in": plan[parent]})
                                  .values_list("pk", flat=True))
        invoice = None
        if options["adjunto_factura"]:
            try:
                invoice = m.RegistroFactura.objects.get(numero=options["adjunto_factura"], **scope)
            except (m.RegistroFactura.DoesNotExist, m.RegistroFactura.MultipleObjectsReturned) as error:
                raise CommandError("RegistroFactura: el número no identifica una única factura del financiador.") from error

        request_ids = plan[m.SolicitudAutorizacion]
        requests = list(_selected(m.SolicitudAutorizacion, request_ids)
                        .select_related("ciudadano", "afiliado", "caso"))
        problems = [*_blockers(plan), *_authorization_blockers(requests, request_ids)]
        clinical_count = _clinical_access_count(plan, requests)
        if clinical_count and not options["permitir_accesos_clinicos"]:
            problems.append(f"AccesoClinico: {clinical_count}. Usá --permitir-accesos-clinicos para conservarlos y continuar.")
        files = [("prescripciones", path) for path in _selected(
            m.PrescripcionAutorizacion, plan[m.PrescripcionAutorizacion],
        ).values_list("ruta", flat=True)]
        if invoice and invoice.adjunto_ruta:
            if m.RegistroFactura.objects.filter(adjunto_ruta=invoice.adjunto_ruta).exclude(pk=invoice.pk).exists():
                problems.append("RegistroFactura: el archivo del adjunto está referenciado por otra factura.")
            files.append(("facturas", invoice.adjunto_ruta))
        if problems:
            raise CommandError("Dependencias fuera del plan; no se modificó nada:\n" + "\n".join(problems))
        for _, path in files:
            try:
                validate_file_name(path)
            except SuspiciousFileOperation as error:
                raise CommandError("La clave de un adjunto no tiene el formato esperado.") from error

        batches = {
            model: list(_leaf_batches(model, plan[model], field))
            for model, field in ((m.SolicitudAutorizacion, "anterior_id"), (m.Afiliado, "titular_id"))
        }
        counts = {model.__name__: len(plan[model]) for model in DELETE_ORDER if plan[model]}
        clear_invoice = invoice and any(getattr(invoice, name) != value for name, value in ATTACHMENT_FIELDS.items())
        self.stdout.write(f"Financiador {funder.pk} | {'Aplicar' if options['aplicar'] else 'Simulación'}")
        for model_name, count in counts.items():
            self.stdout.write(f"  {model_name}: {count} a borrar")
        self.stdout.write(f"  RegistroFactura: {int(bool(clear_invoice))} adjunto a desvincular")
        if clinical_count:
            self.stdout.write(f"  AccesoClinico: {clinical_count} a conservar")
        for alias, path in sorted(files):
            self.stdout.write(f"  {alias}/{path}")
        if not options["aplicar"] or not (counts or clear_invoice):
            return
        if files and not archivos.corresponde_vaciar():
            raise CommandError("Se requiere almacenamiento en bucket para aplicar un plan con archivos.")

        for model in DELETE_ORDER:
            for ids in batches.get(model, [plan[model]]):
                if ids:
                    _, deleted = _selected(model, ids).delete()
                    if deleted != {model._meta.label: len(ids)}:
                        raise CommandError(f"Borrado inesperado de {model.__name__}; se revierte todo el plan.")
        if clear_invoice:
            _selected(m.RegistroFactura, [invoice.pk]).update(**ATTACHMENT_FIELDS, actualizado=timezone.now())
        auditar(None, "limpiar_demo", funder.pk, financiador=funder,
                motivo="Limpieza de datos ficticios por CLI; auditoría clínica conservada.")
        transaction.on_commit(lambda: self._after_commit(files))

    def _after_commit(self, files):
        failures = archivos.borrar(files) if files else []
        if failures:
            keys = ", ".join(f"{alias}/{path}" for alias, path in failures)
            raise CommandError(f"La base confirmó los cambios, pero falló el borrado de objetos: {keys}.")
        self.stdout.write("Cambios confirmados.")
