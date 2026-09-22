# apps/users/management/commands/normalizar_emails.py

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    """
    Normaliza (lower + strip) los emails de usuarios existentes que
    quedaron con mayúsculas — típicamente por CrearFuncionarioSerializer
    no normalizando antes del fix de 2026-09, o por alta directa desde
    el admin de Django antes de que UserCreationForm/UserChangeForm
    tuvieran clean_email().

    Por defecto solo muestra qué cambiaría (dry-run). Usar --aplicar
    para ejecutar el UPDATE.

    Nota: la migración que agrega el UniqueConstraint(Lower("email"))
    ya incluye su propia normalización (RunPython) como primer paso,
    así que correr `migrate` alcanza aunque nunca se use este comando
    a mano. Este comando queda como herramienta reutilizable si el
    problema reaparece por otra vía no cubierta.
    """

    help = "Normaliza a minúsculas los emails de usuarios existentes que tengan mayúsculas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--aplicar",
            action="store_true",
            help="Ejecuta el UPDATE. Sin esta bandera, solo muestra qué cambiaría.",
        )

    def handle(self, *args, **options):
        from users.models import User

        afectados = []
        for user in User.objects.all().only("id", "email"):
            normalizado = user.email.lower().strip()
            if normalizado != user.email:
                afectados.append((user, normalizado))

        if not afectados:
            self.stdout.write(self.style.SUCCESS("No hay emails para normalizar."))
            return

        for user, normalizado in afectados:
            self.stdout.write(f"  id={user.id}  {user.email!r} -> {normalizado!r}")

        if not options["aplicar"]:
            self.stdout.write(
                self.style.WARNING(
                    f"\n{len(afectados)} email(s) para normalizar. "
                    "Repetí con --aplicar para ejecutar el cambio."
                )
            )
            return

        with transaction.atomic():
            for user, normalizado in afectados:
                user.email = normalizado
                user.save(update_fields=["email"])

        self.stdout.write(
            self.style.SUCCESS(f"\n{len(afectados)} email(s) normalizado(s).")
        )
