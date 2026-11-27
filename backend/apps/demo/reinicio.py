"""Reset demo tables without dropping shared geography reference data."""
from django.apps import apps
from django.core.management.color import no_style
from django.core.management.sql import emit_post_migrate_signal

from apps.financiadores.models import Financiador
from apps.geografia.models import Catalogo, Lugar, Ubicacion
from apps.instituciones.models import Institucion


def vaciar_datos_demo(connection):
    """Run inside the full seed transaction, on PostgreSQL only."""
    tables = set(connection.introspection.django_table_names(only_existing=True, include_views=False))
    geography = {model._meta.db_table for model in apps.get_app_config("geografia").get_models(include_auto_created=True)}
    geography &= tables
    owners = {model._meta.db_table for model in (Institucion, Financiador)}
    catalog = Catalogo._meta.db_table
    quote = connection.ops.quote_name

    with connection.cursor() as cursor:
        # Georef sync locks the catalog before publishing places. Block it here
        # before taking any other locks, including on an empty catalog.
        locked = ", ".join(map(quote, [catalog, *sorted((geography - {catalog}) | owners)]))
        cursor.execute(f"LOCK TABLE {locked} IN ACCESS EXCLUSIVE MODE")

        # PostgreSQL rejects TRUNCATE of an owner even if the referencing
        # geografia_lugar table is empty; CASCADE would erase reference data.
        for statement in connection.ops.sql_flush(no_style(), sorted(tables - geography - owners), reset_sequences=True):
            cursor.execute(statement)

        location, place = quote(Ubicacion._meta.db_table), quote(Lugar._meta.db_table)
        cursor.execute(f"""
            DELETE FROM {location} AS address
            WHERE EXISTS (
                SELECT 1 FROM {place} AS place
                WHERE place.origen = %s
                  AND place.id IN (address.provincia_id, address.partido_id, address.localidad_id)
            )
        """, ["manual"])
        # These FKs (including self-references) are initially deferred. Remove
        # both private addresses and their owners before reseeding either one.
        cursor.execute(f"DELETE FROM {place} WHERE origen = %s", ["manual"])
        for table in sorted(owners):
            cursor.execute(f"DELETE FROM {quote(table)}")
            for sequence in connection.introspection.get_sequences(cursor, table):
                cursor.execute(f"ALTER SEQUENCE {quote(sequence['name'])} RESTART")

    # Match flush: seed steps expect regenerated auth permissions/content types.
    emit_post_migrate_signal(verbosity=0, interactive=False, db=connection.alias)
