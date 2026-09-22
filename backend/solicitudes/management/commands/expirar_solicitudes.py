# apps/solicitudes/management/commands/expirar_solicitudes.py

from django.core.management.base import BaseCommand

from solicitudes.services.expirar_solicitudes import expirar_solicitudes_vencidas


class Command(BaseCommand):

    help = (
        "Expira solicitudes APROBADAS vencidas y rechaza "
        "solicitudes OBSERVADAS cuyo plazo de 24h venció. "
        "No hace falta correrlo a mano: el mismo chequeo corre "
        "solo (con una guarda de 5 minutos) cada vez que alguien "
        "carga el listado de solicitudes, el dashboard o las "
        "estadísticas. Este comando queda para uso manual o para "
        "programarlo aparte (ej. un Cron Schedule de Railway) si "
        "en algún momento hace falta una garantía de timing más "
        "estricta que la de la ejecución perezosa."
    )

    def handle(self, *args, **options):
        resultado = expirar_solicitudes_vencidas()

        if resultado["expiradas"] == 0 and resultado["rechazadas"] == 0:
            self.stdout.write("Nada para expirar ni rechazar por vencimiento.")
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"{resultado['expiradas']} solicitud(es) aprobada(s) expirada(s)."
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"{resultado['rechazadas']} solicitud(es) observada(s) "
                f"rechazada(s) por vencimiento."
            )
        )
