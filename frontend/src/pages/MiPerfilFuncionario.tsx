// src/pages/MiPerfilFuncionario.tsx
//
// Perfil compartido por ANH, ADMIN y ESS — mismo contenido para los
// tres roles salvo la tarjeta "Estación asignada", que solo aplica a
// ESS. Se enruta directamente desde dos rutas distintas en App.tsx
// (/anh/perfil y /estacion/perfil); no hay wrappers de página por rol
// porque no hay nada que diferenciar más allá de esa tarjeta, que este
// componente ya resuelve solo mirando tipo_usuario.

import Layout from "../components/Layout";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { EstadoCuentaBadge } from "../components/ui/EstadoBadge";
import { CambiarPasswordModal } from "../components/ui/CambiarPasswordModal";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import type { TipoDocumento } from "../services/users.service";
import {
  User, Briefcase, Building2, Shield, KeyRound,
  CheckCircle, AlertTriangle,
} from "lucide-react";

// Coincide con PerfilFuncionario.TipoDocumento del backend
// (mismo criterio que pages/admin/GestionUsuarios.tsx).
const TIPOS_DOC: Record<TipoDocumento, string> = {
  CI:         "Cédula de Identidad",
  PASAPORTE:  "Pasaporte",
  EXTRANJERO: "Carnet de Extranjero",
};

export default function MiPerfilFuncionario() {
  // ProtectedRoute garantiza que user ya está cargado al montar esta
  // página, así que no hace falta un fetch ni un estado de carga propio.
  const { user } = useAuth();
  const perfil = user?.perfil_funcionario ?? null;

  const [modalPassword, setModalPassword] = useState(false);

  if (!user) return null;

  const documento = perfil
    ? `${TIPOS_DOC[perfil.tipo_documento] ?? perfil.tipo_documento} ${perfil.numero_documento}${
        perfil.complemento_documento ? `-${perfil.complemento_documento}` : ""
      }`
    : "—";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>
          <p className="text-muted-foreground text-sm mt-1">Información de tu cuenta</p>
        </div>

        {/* DATOS PERSONALES */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Datos personales</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Nombre completo</p>
              <p className="text-sm font-medium text-foreground">{user.nombre_completo}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Correo</p>
              <p className="text-sm font-medium text-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* DATOS INSTITUCIONALES */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Datos institucionales</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            {[
              ["Cargo",              perfil?.cargo || "—"],
              ["Unidad / Departamento", perfil?.unidad_departamento || "—"],
              ["N° de funcionario",  perfil?.numero_funcionario || "—"],
              ["Documento",          documento],
              ["Celular",            perfil?.celular || "—"],
            ].map(([label, valor]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="text-sm font-medium text-foreground">{valor}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ESTACIÓN ASIGNADA — solo ESS */}
        {user.tipo_usuario === "ESS" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Estación asignada</h2>
            </div>
            <div className="px-6 py-4">
              {user.estacion_nombre ? (
                <div className="flex items-center gap-2.5 bg-primary/10 rounded-xl px-4 py-3">
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm font-medium text-primary">{user.estacion_nombre}</p>
                </div>
              ) : (
                <Alert
                  type="warning"
                  message="Sin estación asignada. Contacta al administrador."
                />
              )}
            </div>
          </div>
        )}

        {/* ESTADO DE CUENTA */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Estado de cuenta</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estado</p>
              <EstadoCuentaBadge estado={user.estado_cuenta} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Correo electrónico</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.email_verificado
                  ? "bg-state-success-bg text-state-success-fg"
                  : "bg-state-pending-bg text-state-pending-fg"
              }`}>
                {user.email_verificado
                  ? <CheckCircle className="w-3 h-3" />
                  : <AlertTriangle className="w-3 h-3" />}
                {user.email_verificado ? "Verificado" : "Sin verificar"}
              </span>
            </div>
          </div>
        </div>

        {/* SEGURIDAD */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Seguridad</h2>
          </div>
          <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-foreground">Contraseña</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cambia tu contraseña de acceso al sistema.
              </p>
            </div>
            <Button
              variant="outline"
              icon={<KeyRound className="w-4 h-4" />}
              onClick={() => setModalPassword(true)}
            >
              Cambiar contraseña
            </Button>
          </div>
        </div>
      </div>

      <CambiarPasswordModal open={modalPassword} onClose={() => setModalPassword(false)} />
    </Layout>
  );
}
