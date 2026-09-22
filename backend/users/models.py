# apps/users/models.py

import uuid

from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db.models.functions import Lower
from django.utils import timezone

from .managers import UserManager


# ------------------------------------------------
# USER
# ------------------------------------------------

class User(AbstractBaseUser, PermissionsMixin):
    """
    Modelo base de autenticación para todos los roles del sistema.
    Contiene únicamente datos de autenticación e identidad básica.

    Roles:
        ADMIN → gestión del sistema
        ANH   → operadores de la Agencia Nacional de Hidrocarburos
        ESS   → personal de estaciones de servicio
        CONS  → consumidores que solicitan combustible
    """

    class TipoUsuario(models.TextChoices):
        ADMIN = "ADMIN", "Administrador"
        ANH   = "ANH",   "Personal ANH"
        ESS   = "ESS",   "Personal Estación"
        CONS  = "CONS",  "Consumidor"

    class EstadoCuenta(models.TextChoices):
        PENDIENTE  = "PENDIENTE",  "Pendiente"
        ACTIVO     = "ACTIVO",     "Activo"
        SUSPENDIDO = "SUSPENDIDO", "Suspendido"

    # ------------------------------------------------
    # AUTENTICACIÓN
    # ------------------------------------------------

    email = models.EmailField(
        unique=True,
        verbose_name="Correo electrónico"
    )

    # ------------------------------------------------
    # IDENTIDAD BÁSICA
    # ------------------------------------------------

    nombres = models.CharField(
        max_length=100,
        verbose_name="Nombres"
    )

    apellido_paterno = models.CharField(
        max_length=100,
        verbose_name="Apellido paterno"
    )

    apellido_materno = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Apellido materno"
    )

    # ------------------------------------------------
    # ROL Y ESTADO
    # ------------------------------------------------

    tipo_usuario = models.CharField(
        max_length=10,
        choices=TipoUsuario.choices,
        verbose_name="Tipo de usuario"
    )

    estado_cuenta = models.CharField(
        max_length=20,
        choices=EstadoCuenta.choices,
        default=EstadoCuenta.PENDIENTE,
        verbose_name="Estado de cuenta"
    )

    email_verificado = models.BooleanField(
        default=False,
        verbose_name="Email verificado"
    )

    # ------------------------------------------------
    # SEGURIDAD
    # ------------------------------------------------

    requiere_cambio_password = models.BooleanField(
        default=False,
        verbose_name="Requiere cambio de contraseña"
    )

    intentos_fallidos = models.IntegerField(
        default=0,
        verbose_name="Intentos fallidos de inicio de sesión"
    )

    bloqueado_hasta = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Bloqueado hasta"
    )

    # ------------------------------------------------
    # DJANGO INTERNALS
    # ------------------------------------------------

    is_active = models.BooleanField(default=True)
    is_staff  = models.BooleanField(default=False)

    date_joined = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de registro"
    )

    objects = UserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["nombres", "apellido_paterno", "tipo_usuario"]

    # ------------------------------------------------
    # MÉTODOS
    # ------------------------------------------------

    def esta_bloqueado(self) -> bool:
        if self.bloqueado_hasta and self.bloqueado_hasta > timezone.now():
            return True
        return False

    def nombre_completo(self) -> str:
        partes = [self.nombres, self.apellido_paterno]
        if self.apellido_materno:
            partes.append(self.apellido_materno)
        return " ".join(partes)

    def __str__(self):
        return f"{self.nombre_completo()} <{self.email}>"

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["apellido_paterno", "nombres"]
        constraints = [
            # email ya es unique=True (case-sensitive) a nivel de
            # campo. Este constraint agrega la garantía real que
            # necesitamos: Juan@x.com y juan@x.com no pueden coexistir.
            # No basta con normalizar en cada punto de entrada — la
            # auditoría de 2026-09 encontró cuatro que no lo hacían.
            models.UniqueConstraint(
                Lower("email"),
                name="users_user_email_lower_unique",
            ),
        ]


# ------------------------------------------------
# PERFIL FUNCIONARIO
# Extensión de User para roles: ADMIN, ANH, ESS.
# Creado manualmente por el administrador del sistema.
# ------------------------------------------------

class PerfilFuncionario(models.Model):
    """
    Datos institucionales de funcionarios ADMIN, ANH y ESS.
    Cada funcionario tiene un único perfil vinculado a su cuenta.
    """

    class TipoDocumento(models.TextChoices):
        CI         = "CI",         "Cédula de Identidad"
        PASAPORTE  = "PASAPORTE",  "Pasaporte"
        EXTRANJERO = "EXTRANJERO", "Carnet de Extranjero"

    # ------------------------------------------------
    # RELACIÓN CON USER
    # ------------------------------------------------

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="perfil_funcionario",
        verbose_name="Usuario"
    )

    # ------------------------------------------------
    # DOCUMENTO DE IDENTIDAD
    # ------------------------------------------------

    tipo_documento = models.CharField(
        max_length=20,
        choices=TipoDocumento.choices,
        verbose_name="Tipo de documento"
    )

    numero_documento = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Número de documento"
    )

    complemento_documento = models.CharField(
        max_length=10,
        blank=True,
        default="",
        verbose_name="Complemento"
    )

    # ------------------------------------------------
    # DATOS INSTITUCIONALES
    # ------------------------------------------------

    numero_funcionario = models.CharField(
        max_length=30,
        unique=True,
        verbose_name="Número de funcionario"
    )

    cargo = models.CharField(
        max_length=100,
        verbose_name="Cargo"
    )

    unidad_departamento = models.CharField(
        max_length=100,
        verbose_name="Unidad / Departamento"
    )

    celular = models.CharField(
        max_length=20,
        blank=True,
        default="",
        verbose_name="Celular"
    )

    # ------------------------------------------------
    # ESTACIÓN (solo para ESS)
    # Null para ADMIN y ANH, requerido para ESS.
    # La validación se hace en clean().
    # ------------------------------------------------

    estacion_servicio = models.ForeignKey(
        "estaciones.EstacionServicio",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="funcionarios",
        verbose_name="Estación de servicio"
    )

    # ------------------------------------------------
    # AUDITORÍA
    # ------------------------------------------------

    fecha_creacion      = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    # ------------------------------------------------
    # VALIDACIONES
    # ------------------------------------------------

    def clean(self):
        # ESS puede o no tener estación asignada (un operador recién
        # creado, o temporalmente sin puesto, queda aislado por
        # get_queryset()/EsEstacionAsignada en vez de bloquear su alta).

        # ADMIN y ANH no deben tener estación asignada
        if (
            self.user.tipo_usuario in [
                self.user.TipoUsuario.ADMIN,
                self.user.TipoUsuario.ANH,
            ]
            and self.estacion_servicio
        ):
            raise ValidationError(
                "Los usuarios ADMIN y ANH no deben tener estación asignada."
            )

    # ------------------------------------------------
    # REPRESENTACIÓN
    # ------------------------------------------------

    def __str__(self):
        return (
            f"{self.user.nombre_completo()} — "
            f"{self.cargo} ({self.unidad_departamento})"
        )

    class Meta:
        verbose_name = "Perfil Funcionario"
        verbose_name_plural = "Perfiles Funcionario"


# ------------------------------------------------
# TOKEN VERIFICACION
# Usado para verificación de email y
# recuperación de contraseña.
# ------------------------------------------------

class TokenVerificacion(models.Model):
    """
    Token de un solo uso para verificación de email
    y recuperación de contraseña.
    """

    class TipoToken(models.TextChoices):
        VERIFICACION_EMAIL    = "EMAIL", "Verificación Email"
        RECUPERACION_PASSWORD = "RECUP", "Recuperación Password"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tokens_verificacion",
        verbose_name="Usuario"
    )

    token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        verbose_name="Token"
    )

    codigo_pin = models.CharField(
        max_length=6,
        blank=True,
        default="",
        verbose_name="Código PIN"
    )

    tipo = models.CharField(
        max_length=10,
        choices=TipoToken.choices,
        verbose_name="Tipo"
    )

    usado = models.BooleanField(
        default=False,
        verbose_name="Usado"
    )

    fecha_creacion   = models.DateTimeField(auto_now_add=True)
    fecha_expiracion = models.DateTimeField(verbose_name="Fecha de expiración")

    # ------------------------------------------------
    # MÉTODOS
    # ------------------------------------------------

    def esta_expirado(self) -> bool:
        return timezone.now() > self.fecha_expiracion

    def es_valido(self) -> bool:
        return not self.usado and not self.esta_expirado()

    def __str__(self):
        return f"{self.tipo} — {self.user.email}"

    class Meta:
        verbose_name = "Token de verificación"
        verbose_name_plural = "Tokens de verificación"
        ordering = ["-fecha_creacion"]