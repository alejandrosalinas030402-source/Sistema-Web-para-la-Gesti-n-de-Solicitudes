# apps/users/serializers_admin.py
#
# Serializer para cuando un funcionario ANH/ADMIN registra a un consumidor
# (típicamente en atención presencial).
#
# Se separa del RegistroConsumidorSerializer (auto-registro público) porque
# las reglas de negocio son distintas:
#   - El admin no elige contraseña — la genera el backend
#   - El email se marca como verificado (el admin verificó el documento físico)
#   - La cuenta queda ACTIVA — no se envía PIN de verificación
#   - Se fuerza el cambio de contraseña en el primer login
#   - Devuelve la contraseña temporal para que el admin la comparta

import secrets

from django.db import transaction
from rest_framework import serializers

from .models import User


ALFABETO_PASSWORD = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def _generar_password_temporal(longitud: int = 12) -> str:
    """
    Contraseña temporal criptográficamente segura, sin caracteres
    ambiguos (0/O, 1/l/I) para reducir errores al transcribirla.
    """
    return "".join(secrets.choice(ALFABETO_PASSWORD) for _ in range(longitud))


class RegistroConsumidorPorAdminSerializer(serializers.Serializer):
    """
    Registro de consumidor iniciado por ANH/ADMIN.

    Mismos campos que RegistroConsumidorSerializer EXCEPTO password/password2,
    que genera el backend.
    """

    # --- Datos de User ---
    email            = serializers.EmailField()
    nombres          = serializers.CharField(max_length=100)
    apellido_paterno = serializers.CharField(max_length=100)
    apellido_materno = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )

    # --- Datos de ConsumidorPerfil ---
    fecha_nacimiento = serializers.DateField()
    celular          = serializers.CharField(max_length=20)

    departamento = serializers.PrimaryKeyRelatedField(queryset=[])
    provincia    = serializers.PrimaryKeyRelatedField(queryset=[])
    municipio    = serializers.PrimaryKeyRelatedField(queryset=[])
    direccion    = serializers.CharField(max_length=100)
    actividad    = serializers.ChoiceField(choices=[])

    # --- Datos de DocumentoIdentidad ---
    tipo_documento        = serializers.ChoiceField(choices=[])
    numero_documento      = serializers.CharField(max_length=30)
    complemento_documento = serializers.CharField(
        max_length=10, required=False, allow_blank=True, default=""
    )
    anverso          = serializers.ImageField()
    reverso          = serializers.ImageField()
    foto_sosteniendo = serializers.ImageField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from catalogos.models import Departamento, Provincia, Municipio
        from consumidores.models import ConsumidorPerfil, DocumentoIdentidad

        self.fields["departamento"].queryset  = Departamento.objects.all()
        self.fields["provincia"].queryset     = Provincia.objects.all()
        self.fields["municipio"].queryset     = Municipio.objects.all()
        self.fields["actividad"].choices      = ConsumidorPerfil.ActividadEconomica.choices
        self.fields["tipo_documento"].choices = DocumentoIdentidad.TipoDocumento.choices

    # ------------------------------------------------
    # VALIDACIONES (mismas que el registro público)
    # ------------------------------------------------

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "Ya existe una cuenta registrada con este correo."
            )
        return value

    def validate_numero_documento(self, value):
        from consumidores.models import DocumentoIdentidad
        if DocumentoIdentidad.objects.filter(numero_documento=value).exists():
            raise serializers.ValidationError(
                "Este número de documento ya está registrado en el sistema."
            )
        return value

    def validate_fecha_nacimiento(self, value):
        from datetime import date
        hoy  = date.today()
        edad = (
            hoy.year - value.year
            - ((hoy.month, hoy.day) < (value.month, value.day))
        )
        if edad < 18:
            raise serializers.ValidationError(
                "El consumidor debe ser mayor de 18 años."
            )
        return value

    def validate(self, attrs):
        prov = attrs.get("provincia")
        dep  = attrs.get("departamento")
        if prov and dep and prov.departamento_id != dep.id:
            raise serializers.ValidationError({
                "provincia": "La provincia no pertenece al departamento seleccionado."
            })

        mun = attrs.get("municipio")
        if mun and prov and mun.provincia_id != prov.id:
            raise serializers.ValidationError({
                "municipio": "El municipio no pertenece a la provincia seleccionada."
            })

        return attrs

    def _validar_imagen(self, value, nombre):
        tipos_permitidos = ["image/jpeg", "image/png", "image/webp"]
        limite_mb = 5
        if value.content_type not in tipos_permitidos:
            raise serializers.ValidationError(
                f"El {nombre} debe ser JPG, PNG o WebP."
            )
        if value.size > limite_mb * 1024 * 1024:
            raise serializers.ValidationError(
                f"El {nombre} no puede superar los {limite_mb} MB."
            )
        return value

    def validate_anverso(self, value):
        return self._validar_imagen(value, "anverso")

    def validate_reverso(self, value):
        return self._validar_imagen(value, "reverso")

    def validate_foto_sosteniendo(self, value):
        return self._validar_imagen(value, "foto sosteniendo el documento")

    # ------------------------------------------------
    # CREACIÓN
    # Misma orquestación que RegistroConsumidorSerializer.create(),
    # pero con contraseña autogenerada y cuenta ya activa/verificada.
    # ------------------------------------------------

    @transaction.atomic
    def create(self, validated_data):
        from consumidores.models import ConsumidorPerfil, DocumentoIdentidad

        password_temporal = _generar_password_temporal()

        campos_user   = ["email", "nombres", "apellido_paterno", "apellido_materno"]
        campos_perfil = [
            "fecha_nacimiento", "celular", "departamento",
            "provincia", "municipio", "direccion", "actividad",
        ]
        campos_doc = [
            "tipo_documento", "numero_documento", "complemento_documento",
            "anverso", "reverso", "foto_sosteniendo",
        ]

        user_data   = {k: validated_data.pop(k) for k in campos_user   if k in validated_data}
        perfil_data = {k: validated_data.pop(k) for k in campos_perfil if k in validated_data}
        doc_data    = {k: validated_data.pop(k) for k in campos_doc    if k in validated_data}

        user = User(tipo_usuario=User.TipoUsuario.CONS, **user_data)
        user.set_password(password_temporal)

        # Diferencia clave con el registro público: el admin ya verificó
        # la identidad presencialmente, así que la cuenta nace activa
        # y sin necesidad de PIN de verificación de email.
        user.email_verificado         = True
        user.estado_cuenta            = User.EstadoCuenta.ACTIVO
        user.requiere_cambio_password = True

        user.full_clean()
        user.save()

        perfil = ConsumidorPerfil.objects.create(user=user, **perfil_data)
        DocumentoIdentidad.objects.create(perfil=perfil, **doc_data)

        # Se adjunta al objeto (no persiste) para que la view
        # pueda devolverla en la respuesta.
        user._password_temporal = password_temporal
        return user