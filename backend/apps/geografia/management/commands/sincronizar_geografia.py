import time

from django.core.management.base import BaseCommand, CommandError

from apps.geografia.models import Catalogo, Ejecucion
from apps.geografia.sincronizacion import corresponde, sincronizar


class Command(BaseCommand):
    help = "Poblar/actualizar el catálogo propio desde Georef. No procesa domicilios de personas."

    def add_arguments(self, parser):
        parser.add_argument("--seco", action="store_true", help="Descarga y valida sin publicar en DB.")
        parser.add_argument("--periodico", action="store_true", help="Proceso independiente: actualización semanal; reintento diario ante fallas.")
        parser.add_argument("--si-corresponde", action="store_true",
                            help="Una sola corrida para un programador externo (cron): actualiza sólo si corresponde, registra la corrida y termina.")

    def handle(self, *args, **options):
        if sum(bool(options[o]) for o in ("seco", "periodico", "si_corresponde")) > 1:
            raise CommandError("Usá sólo una de --seco, --periodico o --si-corresponde.")
        if options["si_corresponde"]:
            return self.corrida_programada()
        while True:
            if not options["periodico"] or corresponde(Catalogo.objects.filter(pk=1).first()):
                try:
                    resultado = sincronizar(seco=options["seco"])
                    self.stdout.write(f"Geografía: {resultado['entidades']} entidades; publicado={resultado['publicado']}.")
                except Exception:
                    if not options["periodico"]:
                        raise CommandError("Falló la sincronización; no se publicó una descarga parcial.") from None
                    self.stderr.write("Falló la sincronización; se conserva el catálogo anterior. Se reintentará más tarde.")
            if not options["periodico"]:
                return
            time.sleep(3600)

    def corrida_programada(self):
        if not corresponde(Catalogo.objects.filter(pk=1).first()):
            Ejecucion.registrar("omitido")
            self.stdout.write("Geografía cron: catálogo vigente o reintento pendiente; no se descarga.")
            return
        self.stdout.write("Geografía cron: corresponde actualizar.")
        try:
            resultado = sincronizar()
        except Exception:
            Ejecucion.registrar("fallo")
            # Non-zero exit so the scheduler marks the run as failed; no external error text.
            raise CommandError("Falló la sincronización; se conserva el catálogo anterior. Se reintentará en el próximo turno.") from None
        Ejecucion.registrar("superado" if resultado.get("superado") else "publicado", resultado["entidades"])
        self.stdout.write(f"Geografía: {resultado['entidades']} entidades; publicado={resultado['publicado']}.")
