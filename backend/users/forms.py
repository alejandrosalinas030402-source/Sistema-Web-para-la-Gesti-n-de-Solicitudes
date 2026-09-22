# apps/users/forms.py

from django import forms
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.db import transaction

from .models import User, PerfilFuncionario


# ------------------------------------------------
# CREAR USUARIO + PERFIL FUNCIONARIO
# Usado en el Django Admin para crear funcionarios
# ADMIN, ANH y ESS en un solo paso.
# ------------------------------------------------

class UserCreationForm(forms.ModelForm):

    password1 = forms.CharField(
        label="Contraseña",
        widget=forms.PasswordInput
    )
    password2 = forms.CharField(
        label="Confirmar contraseña",
        widget=forms.PasswordInput
    )

    # Campos de PerfilFuncionario incluidos en el form
    tipo_documento = forms.ChoiceField(
        label="Tipo de documento",
        choices=PerfilFuncionario.TipoDocumento.choices
    )
    numero_documento = forms.CharField(
        label="Número de documento",
        max_length=20
    )
    complemento_documento = forms.CharField(
        label="Complemento",
        max_length=10,
        required=False
    )
    numero_funcionario = forms.CharField(
        label="Número de funcionario",
        max_length=30
    )
    cargo = forms.CharField(
        label="Cargo",
        max_length=100
    )
    unidad_departamento = forms.CharField(
        label="Unidad / Departamento",
        max_length=100
    )
    celular = forms.CharField(
        label="Celular",
        max_length=20,
        required=False
    )
    estacion_servicio = forms.ModelChoiceField(
        label="Estación de servicio",
        queryset=None,  # Se asigna en __init__
        required=False
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from estaciones.models import EstacionServicio
        self.fields["estacion_servicio"].queryset = (
            EstacionServicio.objects.filter(estado="ACTIVA")
        )

    class Meta:
        model = User
        fields = [
            "email",
            "nombres",
            "apellido_paterno",
            "apellido_materno",
            "tipo_usuario",
        ]

    # ------------------------------------------------
    # VALIDACIONES
    # ------------------------------------------------

    def clean_email(self):
        return self.cleaned_data["email"].lower().strip()

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")

        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Las contraseñas no coinciden.")

        return password2

    def clean(self):
        cleaned_data = super().clean()
        tipo_usuario = cleaned_data.get("tipo_usuario")
        estacion     = cleaned_data.get("estacion_servicio")

        # ESS puede quedar sin estación asignada (mismo criterio que
        # PerfilFuncionario.clean() y CrearFuncionarioSerializer — este
        # form del admin de Django es un segundo camino de alta y tener
        # reglas distintas para lo mismo según la vía usada es peor
        # que mantener el chequeo comentado acá para que quede claro
        # que la ausencia es intencional, no un olvido).

        # ADMIN y ANH no deben tener estación
        if (
            tipo_usuario in [User.TipoUsuario.ADMIN, User.TipoUsuario.ANH]
            and estacion
        ):
            self.add_error(
                "estacion_servicio",
                "Los usuarios ADMIN y ANH no deben tener estación asignada."
            )

        # Solo ADMIN, ANH y ESS pueden crearse desde el admin
        if tipo_usuario == User.TipoUsuario.CONS:
            self.add_error(
                "tipo_usuario",
                "Los consumidores se registran desde el frontend."
            )

        return cleaned_data

    # ------------------------------------------------
    # GUARDAR
    # ------------------------------------------------

    @transaction.atomic
    def save(self, commit=True):

        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        user.estado_cuenta    = User.EstadoCuenta.ACTIVO
        user.email_verificado = True

        if commit:
            user.save()

            PerfilFuncionario.objects.create(
                user                  = user,
                tipo_documento        = self.cleaned_data["tipo_documento"],
                numero_documento      = self.cleaned_data["numero_documento"],
                complemento_documento = self.cleaned_data.get("complemento_documento", ""),
                numero_funcionario    = self.cleaned_data["numero_funcionario"],
                cargo                 = self.cleaned_data["cargo"],
                unidad_departamento   = self.cleaned_data["unidad_departamento"],
                celular               = self.cleaned_data.get("celular", ""),
                estacion_servicio     = self.cleaned_data.get("estacion_servicio"),
            )

        return user


# ------------------------------------------------
# EDITAR USUARIO EXISTENTE
# Solo expone campos seguros para edición.
# Campos sensibles como intentos_fallidos y
# bloqueado_hasta se gestionan desde el admin
# directamente, no desde este form.
# ------------------------------------------------

class UserChangeForm(forms.ModelForm):

    password = ReadOnlyPasswordHashField(
        label="Contraseña",
        help_text=(
            "Las contraseñas no se almacenan en texto plano. "
            "Use el panel de administración para cambiarla."
        )
    )

    class Meta:
        model = User
        fields = [
            "email",
            "nombres",
            "apellido_paterno",
            "apellido_materno",
            "tipo_usuario",
            "estado_cuenta",
            "email_verificado",
            "is_active",
            "is_staff",
            "password",
        ]

    def clean_email(self):
        return self.cleaned_data["email"].lower().strip()