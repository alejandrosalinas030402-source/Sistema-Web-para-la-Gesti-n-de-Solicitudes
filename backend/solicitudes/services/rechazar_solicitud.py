# apps/solicitudes/services/rechazar_solicitud.py

from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from solicitudes.models import Solicitud


def rechazar_solicitud(
    solicitud: Solicitud,
    usuario,
    observacion_anh: str,
) -> Solicitud:

    with transaction.atomic():

        # Bloquea la fila para evitar condiciones de carrera
        solicitud = (
            Solicitud.objects
            .select_for_update()
            .select_related("consumidor")
            .get(id=solicitud.id)
        )

        # -----------------------------------------
        # Validar estado actual
        # -----------------------------------------

        if solicitud.estado not in [
            Solicitud.EstadoSolicitud.PENDIENTE,
            Solicitud.EstadoSolicitud.OBSERVADA,
        ]:
            raise ValidationError(
                "Solo se pueden rechazar solicitudes pendientes u observadas."
            )

        # -----------------------------------------
        # Registrar rechazo
        # -----------------------------------------

        estado_anterior = solicitud.estado

        solicitud.estado          = Solicitud.EstadoSolicitud.RECHAZADA
        solicitud.observacion_anh = observacion_anh
        solicitud.fecha_revision  = timezone.now()

        solicitud.full_clean()
        solicitud.save()

        # Registrar auditoría — el rechazo es una decisión que el
        # consumidor podría impugnar; hasta 2026-09 no quedaba en el
        # timeline, a diferencia de aprobar/observar.
        from .registrar_auditoria import registrar_cambio_estado
        registrar_cambio_estado(
            solicitud       = solicitud,
            estado_anterior = estado_anterior,
            estado_nuevo    = Solicitud.EstadoSolicitud.RECHAZADA,
            usuario         = usuario,
            nota            = f"Rechazo: {observacion_anh}",
        )

        # Notificar al consumidor
        from users.email_service import enviar_notificacion_solicitud_rechazada
        enviar_notificacion_solicitud_rechazada(solicitud)

        return solicitud