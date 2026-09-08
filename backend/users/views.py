# apps/users/views.py
import os
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.conf import settings
from django.db import models

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.parsers import MultiPartParser, FormParser
from .serializers_admin import RegistroConsumidorPorAdminSerializer

from .models import User, TokenVerificacion
from .services import crear_token_verificacion
from .email_service import (
    enviar_pin_verificacion,
    enviar_token_recuperacion,
)
from .serializers import (
    LoginSerializer,
    RegistroConsumidorSerializer,
    CrearFuncionarioSerializer,
    VerificarEmailSerializer,
    SolicitarRecuperacionSerializer,
    RecuperarPasswordSerializer,
    CambiarPasswordSerializer,
    UserSerializer,
)


# ------------------------------------------------
# HELPERS
# ------------------------------------------------

def _set_auth_cookies(response, access: str, refresh: str) -> None:
    """
    Setea las cookies httponly con access y refresh tokens.
    Lee samesite y secure desde settings.SIMPLE_JWT para que
    funcione cross-origin en producción (Vercel ↔ Railway).
    """
    samesite = settings.SIMPLE_JWT.get("AUTH_COOKIE_SAMESITE", "Lax")
    secure   = settings.SIMPLE_JWT.get("AUTH_COOKIE_SECURE", not settings.DEBUG)

    response.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def _clear_auth_cookies(response) -> None:
    """
    Elimina las cookies de autenticación.
    Usa los mismos atributos que _set_auth_cookies
    para garantizar que el navegador las elimine correctamente.
    """
    samesite = settings.SIMPLE_JWT.get("AUTH_COOKIE_SAMESITE", "Lax")
    secure   = settings.SIMPLE_JWT.get("AUTH_COOKIE_SECURE", not settings.DEBUG)

    response.delete_cookie("access_token",  samesite=samesite)
    response.delete_cookie("refresh_token", samesite=samesite)


# ------------------------------------------------
# REGISTRO DE CONSUMIDOR
# ------------------------------------------------

class RegistroConsumidorView(APIView):
    """
    Registro público de consumidores desde el frontend.
    Crea User (CONS) + ConsumidorPerfil en una transacción.
    El estado queda PENDIENTE hasta verificar email.
    """

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = RegistroConsumidorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = serializer.save()
        except IntegrityError:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"email": "Ya existe una cuenta registrada con este correo."}
            )

        # Generar y enviar PIN de verificación de email
        token = crear_token_verificacion(
            user=user,
            tipo=TokenVerificacion.TipoToken.VERIFICACION_EMAIL
        )

        enviar_pin_verificacion(user=user, pin=token.codigo_pin)

        return Response(
            {
                "detail": (
                    "Registro exitoso. Revise su correo para "
                    "verificar su cuenta."
                ),
                "email": user.email,
            },
            status=status.HTTP_201_CREATED
        )


# ------------------------------------------------
# CREAR FUNCIONARIO (ADMIN)
# ------------------------------------------------

class CrearFuncionarioView(APIView):
    """
    Creación de funcionarios ADMIN, ANH y ESS.
    Solo accesible por administradores del sistema.
    Crea User + PerfilFuncionario en un solo paso.

    La contraseña la genera el backend y se devuelve una única vez
    en la respuesta para que el administrador la comunique. El
    funcionario debe cambiarla en su primer ingreso.
    """

    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        return [IsAuthenticated()]

    def post(self, request):

        # Solo ADMIN puede crear funcionarios
        if request.user.tipo_usuario != User.TipoUsuario.ADMIN:
            return Response(
                {"detail": "Solo los administradores pueden crear funcionarios."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CrearFuncionarioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = serializer.save()
        except IntegrityError:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"email": "Ya existe un funcionario registrado con este correo o documento."}
            )

        return Response(
            {
                "detail":            "Funcionario creado exitosamente.",
                "email":             user.email,
                "tipo_usuario":      user.tipo_usuario,
                "password_temporal": user._password_temporal,
                "aviso": (
                    "El funcionario deberá cambiar esta contraseña "
                    "al iniciar sesión por primera vez."
                ),
            },
            status=status.HTTP_201_CREATED
        )


# ------------------------------------------------
# LOGIN
# ------------------------------------------------

class LoginView(APIView):
    """
    Autenticación por email y contraseña.
    Retorna tokens JWT como cookies httponly Y en el body
    de la respuesta (campo "access") para que el frontend
    pueda usarlo como header Authorization Bearer en casos
    donde las cookies cross-origin fallan (Safari iOS, etc).
    Registra intentos fallidos y bloquea tras 5 intentos.
    """

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = LoginSerializer(
            data=request.data,
            context={"request": request}
        )

        if not serializer.is_valid():
            # Registrar intento fallido si el usuario existe
            email = request.data.get("email", "")
            try:
                user = User.objects.get(email=email)
                from configuracion.models import ConfiguracionSistema
                config = ConfiguracionSistema.obtener()

                user.intentos_fallidos += 1

                # Bloquear tras superar el máximo configurado
                if user.intentos_fallidos >= config.max_intentos_fallidos:
                    user.bloqueado_hasta = timezone.now() + timezone.timedelta(
                        minutes=config.tiempo_bloqueo_minutos
                    )

                user.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])
            except User.DoesNotExist:
                pass

            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        user = serializer.validated_data["user"]

        # Resetear intentos fallidos tras login exitoso
        if user.intentos_fallidos > 0:
            user.intentos_fallidos = 0
            user.bloqueado_hasta = None
            user.save(update_fields=["intentos_fallidos", "bloqueado_hasta"])

        # Generar tokens JWT
        refresh = RefreshToken.for_user(user)
        access  = str(refresh.access_token)

        # IMPORTANTE: enviar access en el body para que el frontend
        # lo use como Authorization Bearer si las cookies fallan
        response = Response(
            {
                "detail": "Login exitoso.",
                "user": UserSerializer(user).data,
                "access": access,
            },
            status=status.HTTP_200_OK
        )

        _set_auth_cookies(response, access=access, refresh=str(refresh))

        return response


# ------------------------------------------------
# REFRESH TOKEN
# ------------------------------------------------

class RefreshView(APIView):
    """
    Renueva el access token usando el refresh token
    almacenado en las cookies. También devuelve el nuevo
    access en el body para que el frontend pueda actualizar
    su header Authorization Bearer.
    """

    permission_classes = [AllowAny]

    def post(self, request):

        refresh_token = request.COOKIES.get("refresh_token")

        if not refresh_token:
            return Response(
                {"detail": "Token no encontrado."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refresh = RefreshToken(refresh_token)
            access  = str(refresh.access_token)

            # IMPORTANTE: enviar access también en el body
            response = Response(
                {
                    "detail": "Token renovado.",
                    "access": access,
                },
                status=status.HTTP_200_OK
            )
            _set_auth_cookies(response, access=access, refresh=refresh_token)
            return response

        except Exception:
            return Response(
                {"detail": "Token inválido o expirado."},
                status=status.HTTP_400_BAD_REQUEST
            )


# ------------------------------------------------
# LOGOUT
# ------------------------------------------------

class LogoutView(APIView):
    """
    Cierra la sesión del usuario autenticado.
    Invalida el refresh token y elimina las cookies.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):

        refresh_token = request.COOKIES.get("refresh_token")

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                # Si el token ya es inválido, igual limpiamos cookies
                pass

        response = Response(
            {"detail": "Logout exitoso."},
            status=status.HTTP_200_OK
        )
        _clear_auth_cookies(response)
        return response


# ------------------------------------------------
# VERIFICAR EMAIL POR PIN
# ------------------------------------------------

class VerificarEmailView(APIView):
    """
    Verifica el email del consumidor mediante un PIN
    de 6 dígitos enviado por correo electrónico.
    La validación completa se delega al serializer.
    """

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = VerificarEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user  = serializer.validated_data["user"]
        token = serializer.validated_data["token"]

        with transaction.atomic():
            user.email_verificado = True
            user.estado_cuenta    = User.EstadoCuenta.ACTIVO
            user.save(update_fields=["email_verificado", "estado_cuenta"])

            token.usado = True
            token.save(update_fields=["usado"])

        return Response(
            {"detail": "Correo verificado correctamente."},
            status=status.HTTP_200_OK
        )


# ------------------------------------------------
# SOLICITAR RECUPERACIÓN DE CONTRASEÑA
# ------------------------------------------------

class SolicitarRecuperacionView(APIView):
    """
    Recibe el email y envía un token de recuperación
    si el usuario existe. Siempre responde con éxito
    para no revelar si el email está registrado.
    """

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = SolicitarRecuperacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email=email)

            # Generar token de recuperación
            # (invalida anteriores internamente)
            token = crear_token_verificacion(
                user=user,
                tipo=TokenVerificacion.TipoToken.RECUPERACION_PASSWORD
            )

            enviar_token_recuperacion(user=user, token_uuid=str(token.token))

        except User.DoesNotExist:
            # No revelamos si el email existe
            pass

        return Response(
            {
                "detail": (
                    "Si el correo está registrado, recibirá "
                    "las instrucciones para recuperar su contraseña."
                )
            },
            status=status.HTTP_200_OK
        )


# ------------------------------------------------
# RECUPERAR CONTRASEÑA (CON TOKEN)
# ------------------------------------------------

class RecuperarPasswordView(APIView):
    """
    Permite cambiar la contraseña usando el token
    de recuperación recibido por correo.
    """

    permission_classes = [AllowAny]

    def post(self, request):

        serializer = RecuperarPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token_obj    = serializer.validated_data["token_obj"]
        password_nuevo = serializer.validated_data["password"]

        with transaction.atomic():
            user = token_obj.user
            user.set_password(password_nuevo)
            user.requiere_cambio_password = False
            user.save(update_fields=["password", "requiere_cambio_password"])

            token_obj.usado = True
            token_obj.save(update_fields=["usado"])

        return Response(
            {"detail": "Contraseña actualizada correctamente."},
            status=status.HTTP_200_OK
        )


# ------------------------------------------------
# CAMBIAR CONTRASEÑA (USUARIO AUTENTICADO)
# ------------------------------------------------

class CambiarPasswordView(APIView):
    """
    Permite al usuario autenticado cambiar su contraseña
    conociendo la actual. También usado cuando
    requiere_cambio_password=True.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):

        serializer = CambiarPasswordSerializer(
            data=request.data,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["password_nuevo"])
        user.requiere_cambio_password = False
        user.save(update_fields=["password", "requiere_cambio_password"])

        # Invalidar sesión actual para forzar nuevo login
        response = Response(
            {
                "detail": (
                    "Contraseña actualizada. "
                    "Por favor inicie sesión nuevamente."
                )
            },
            status=status.HTTP_200_OK
        )
        _clear_auth_cookies(response)
        return response


# ------------------------------------------------
# REENVIAR PIN DE VERIFICACIÓN
# ------------------------------------------------

class ReenviarPinView(APIView):
    """
    Permite al usuario solicitar un nuevo PIN
    si no pudo verificar su cuenta por email.
    Solo funciona si la cuenta no está verificada.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").lower().strip()

        if not email:
            return Response(
                {"detail": "El email es requerido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "Si el correo está registrado y no verificado, recibirás un nuevo PIN."},
                status=status.HTTP_200_OK
            )

        if user.email_verificado:
            return Response(
                {"detail": "Esta cuenta ya está verificada. Inicia sesión normalmente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Invalidar PINs anteriores y generar uno nuevo
        TokenVerificacion.objects.filter(
            user=user,
            tipo=TokenVerificacion.TipoToken.VERIFICACION_EMAIL,
            usado=False,
        ).update(usado=True)

        token = crear_token_verificacion(
            user=user,
            tipo=TokenVerificacion.TipoToken.VERIFICACION_EMAIL
        )
        enviar_pin_verificacion(user=user, pin=token.codigo_pin)

        return Response(
            {"detail": "Se envió un nuevo PIN a tu correo electrónico."},
            status=status.HTTP_200_OK
        )


# ------------------------------------------------
# PERFIL DEL USUARIO AUTENTICADO
# ------------------------------------------------

class MiPerfilView(APIView):
    """
    Retorna los datos del usuario autenticado.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            UserSerializer(request.user).data,
            status=status.HTTP_200_OK
        )


# ------------------------------------------------
# GESTIÓN DE FUNCIONARIOS
# ------------------------------------------------

class FuncionarioListView(APIView):
    """
    Lista todos los funcionarios del sistema.
    ADMIN puede ver ANH, ESS y ADMIN.
    ANH puede ver solo ESS.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.tipo_usuario not in ["ADMIN", "ANH"]:
            return Response(
                {"detail": "No tienes permiso para ver funcionarios."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Filtrar por tipo si se especifica
        tipo = request.query_params.get("tipo_usuario", None)
        search = request.query_params.get("search", "")

        qs = User.objects.exclude(
            tipo_usuario=User.TipoUsuario.CONS
        ).select_related("perfil_funcionario__estacion_servicio")

        # ANH solo puede ver ESS
        if user.tipo_usuario == "ANH":
            qs = qs.filter(tipo_usuario=User.TipoUsuario.ESS)

        if tipo:
            qs = qs.filter(tipo_usuario=tipo)

        if search:
            qs = qs.filter(
                models.Q(nombres__icontains=search) |
                models.Q(apellido_paterno__icontains=search) |
                models.Q(email__icontains=search)
            )

        data = []
        for u in qs:
            perfil = getattr(u, "perfil_funcionario", None)
            data.append({
                "id":               u.id,
                "email":            u.email,
                "nombres":          u.nombres,
                "apellido_paterno": u.apellido_paterno,
                "apellido_materno": u.apellido_materno,
                "nombre_completo":  u.nombre_completo(),
                "tipo_usuario":     u.tipo_usuario,
                "estado_cuenta":    u.estado_cuenta,
                "email_verificado": u.email_verificado,
                "date_joined":      u.date_joined.isoformat(),
                "perfil": {
                    "id":                   perfil.id if perfil else None,
                    "cargo":                perfil.cargo if perfil else "",
                    "unidad_departamento":  perfil.unidad_departamento if perfil else "",
                    "numero_funcionario":   perfil.numero_funcionario if perfil else "",
                    "numero_documento":     perfil.numero_documento if perfil else "",
                    "tipo_documento":       perfil.tipo_documento if perfil else "",
                    "celular":              perfil.celular if perfil else "",
                    "estacion_servicio_id": perfil.estacion_servicio_id if perfil else None,
                    "estacion_nombre":      perfil.estacion_servicio.nombre if perfil and perfil.estacion_servicio else None,
                } if perfil else None,
            })

        return Response(data, status=status.HTTP_200_OK)


class FuncionarioDetailView(APIView):
    """
    Detalle y edición de un funcionario.
    Acepta PUT y PATCH: el update es parcial en ambos casos, ya que
    cada campo usa data.get() con fallback al valor actual.
    """
    permission_classes = [IsAuthenticated]

    def _get_usuario(self, user_id, request_user):
        try:
            u = User.objects.select_related(
                "perfil_funcionario__estacion_servicio"
            ).get(id=user_id)
        except User.DoesNotExist:
            return None

        # ANH solo puede ver ESS
        if request_user.tipo_usuario == "ANH" and u.tipo_usuario != "ESS":
            return None

        # ANH no puede ver otros ANH ni ADMIN
        if request_user.tipo_usuario not in ["ADMIN", "ANH"]:
            return None

        return u

    def get(self, request, user_id):
        u = self._get_usuario(user_id, request.user)
        if not u:
            return Response({"detail": "No encontrado."}, status=status.HTTP_404_NOT_FOUND)

        perfil = getattr(u, "perfil_funcionario", None)
        return Response({
            "id":               u.id,
            "email":            u.email,
            "nombres":          u.nombres,
            "apellido_paterno": u.apellido_paterno,
            "apellido_materno": u.apellido_materno,
            "tipo_usuario":     u.tipo_usuario,
            "estado_cuenta":    u.estado_cuenta,
            "email_verificado": u.email_verificado,
            "date_joined":      u.date_joined.isoformat(),
            "perfil": {
                "id":                   perfil.id if perfil else None,
                "cargo":                perfil.cargo if perfil else "",
                "unidad_departamento":  perfil.unidad_departamento if perfil else "",
                "numero_funcionario":   perfil.numero_funcionario if perfil else "",
                "numero_documento":     perfil.numero_documento if perfil else "",
                "tipo_documento":       perfil.tipo_documento if perfil else "",
                "celular":              perfil.celular if perfil else "",
                "estacion_servicio_id": perfil.estacion_servicio_id if perfil else None,
                "estacion_nombre":      perfil.estacion_servicio.nombre if perfil and perfil.estacion_servicio else None,
            } if perfil else None,
        })

    def put(self, request, user_id):
        u = self._get_usuario(user_id, request.user)
        if not u:
            return Response({"detail": "No encontrado."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data

        # Actualizar datos básicos del usuario
        u.nombres          = data.get("nombres", u.nombres)
        u.apellido_paterno = data.get("apellido_paterno", u.apellido_paterno)
        u.apellido_materno = data.get("apellido_materno", u.apellido_materno)
        u.save(update_fields=["nombres", "apellido_paterno", "apellido_materno"])

        # Actualizar perfil funcionario
        perfil = getattr(u, "perfil_funcionario", None)
        if perfil:
            perfil.cargo               = data.get("cargo", perfil.cargo)
            perfil.unidad_departamento = data.get("unidad_departamento", perfil.unidad_departamento)
            perfil.celular             = data.get("celular", perfil.celular)

            # Estos tres se mostraban en el formulario de edición pero
            # se ignoraban al guardar: el usuario creía haberlos cambiado.
            perfil.numero_funcionario  = data.get("numero_funcionario", perfil.numero_funcionario)
            perfil.tipo_documento      = data.get("tipo_documento", perfil.tipo_documento)
            perfil.numero_documento    = data.get("numero_documento", perfil.numero_documento)

            # Actualizar estacion solo para ESS
            if u.tipo_usuario == "ESS" and "estacion_servicio_id" in data:
                from estaciones.models import EstacionServicio
                try:
                    est = EstacionServicio.objects.get(id=data["estacion_servicio_id"])
                    perfil.estacion_servicio = est
                except EstacionServicio.DoesNotExist:
                    return Response(
                        {"detail": "Estación no encontrada."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # numero_documento y numero_funcionario son unique en el modelo:
            # sin este manejo un duplicado devolvería un 500.
            try:
                perfil.save()
            except IntegrityError:
                return Response(
                    {"detail": "El número de documento o de funcionario ya está en uso."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response({"detail": "Funcionario actualizado correctamente."})

    def patch(self, request, user_id):
        # El update ya es parcial por diseño (data.get con fallback),
        # así que PATCH y PUT comparten implementación.
        return self.put(request, user_id)


class FuncionarioCambiarEstadoView(APIView):
    """
    Activa o suspende un funcionario.
    Solo ADMIN puede cambiar estado de cualquier funcionario.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.tipo_usuario != "ADMIN":
            return Response(
                {"detail": "Solo el administrador puede cambiar el estado de un funcionario."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            u = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=status.HTTP_404_NOT_FOUND)

        nuevo_estado = request.data.get("estado_cuenta")
        if nuevo_estado not in [
            User.EstadoCuenta.ACTIVO,
            User.EstadoCuenta.SUSPENDIDO,
        ]:
            return Response(
                {"detail": "Estado inválido. Use ACTIVO o SUSPENDIDO."},
                status=status.HTTP_400_BAD_REQUEST
            )

        u.estado_cuenta = nuevo_estado
        u.save(update_fields=["estado_cuenta"])

        return Response({
            "detail": f"Estado cambiado a {nuevo_estado}.",
            "estado_cuenta": nuevo_estado,
        })


# ------------------------------------------------
# REGISTRO DE CONSUMIDOR POR ADMIN
# ------------------------------------------------

class RegistroConsumidorPorAdminView(APIView):
    """
    POST /api/users/registro/consumidor-por-admin/

    Registra a un consumidor iniciado por un funcionario ANH o ADMIN
    (típicamente en atención presencial).

    A diferencia del auto-registro público:
      - El admin no elige contraseña — la genera el backend
      - No se envía PIN de verificación (el admin verifica al consumidor
        presencialmente contra su documento físico)
      - El email queda marcado como verificado
      - Se devuelve la contraseña temporal para que el admin la comparta
        con el consumidor

    Solo usuarios ANH o ADMIN autenticados pueden llamar este endpoint.
    """

    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request):

        # Solo ANH y ADMIN pueden registrar consumidores por esta vía.
        if request.user.tipo_usuario not in ("ANH", "ADMIN"):
            return Response(
                {"detail": "Solo ANH o ADMIN pueden registrar consumidores."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = RegistroConsumidorPorAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "message":           "Consumidor registrado correctamente",
                "user_id":           user.id,
                "email":             user.email,
                "password_temporal": user._password_temporal,
                "aviso": (
                    "El consumidor deberá cambiar esta contraseña al iniciar "
                    "sesión por primera vez."
                ),
            },
            status=status.HTTP_201_CREATED,
        )