// src/components/ProtectedRoute.tsx

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  allowedRoles?: string[];
}

const RUTA_CAMBIO_OBLIGATORIO = "/cambiar-password-obligatorio";

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Contraseña generada por un admin: bloquea cualquier ruta protegida
  // (no solo "/") hasta que el usuario elija una nueva. Va antes del
  // chequeo de rol porque aplica a los cuatro tipos de usuario por igual.
  if (user?.requiere_cambio_password && location.pathname !== RUTA_CAMBIO_OBLIGATORIO) {
    return <Navigate to={RUTA_CAMBIO_OBLIGATORIO} replace />;
  }
  if (!user?.requiere_cambio_password && location.pathname === RUTA_CAMBIO_OBLIGATORIO) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.tipo_usuario)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}