// src/pages/CambiarPasswordObligatorio.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import { passwordSeguroSchema, PASSWORD_HELP_TEXT } from "../utils/passwordSchema";
import { Flame, Eye, EyeOff, KeyRound, AlertCircle, ShieldAlert, LogOut } from "lucide-react";

export default function CambiarPasswordObligatorio() {
  const { refreshUser, logout } = useAuth();
  const navigate               = useNavigate();

  const [passwordNuevo,  setPasswordNuevo]  = useState("");
  const [passwordNuevo2, setPasswordNuevo2] = useState("");
  const [verPass,        setVerPass]        = useState(false);
  const [error,          setError]          = useState("");
  const [guardando,      setGuardando]      = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordNuevo || !passwordNuevo2) {
      setError("Completa los dos campos.");
      return;
    }

    const check = passwordSeguroSchema.safeParse(passwordNuevo);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "La contraseña no cumple los requisitos.");
      return;
    }

    if (passwordNuevo !== passwordNuevo2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      await authService.cambiarPasswordObligatorio(passwordNuevo, passwordNuevo2);
      // No hace falta un nuevo login: el backend no invalida la sesión
      // actual. refreshUser() trae requiere_cambio_password=false y
      // "/" deja que RoleRedirect mande al home del rol.
      await refreshUser();
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: unknown } };
      const d = e2.response?.data;
      let msg = "Error al cambiar la contraseña.";
      if (typeof d === "string") {
        msg = d;
      } else if (d && typeof d === "object") {
        const entries = Object.entries(d as Record<string, unknown>);
        if (entries.length > 0) {
          msg = entries.map(([, v]) => (Array.isArray(v) ? v[0] : String(v))).join(" | ");
        }
      }
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const inputCls = "w-full px-4 py-2.5 pr-11 rounded-xl border border-border bg-input text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none";

  return (
    <div className="min-h-screen bg-gradient-to-br from-navbar via-[#1f2d3d] to-navbar flex items-center justify-center p-4">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden">

          {/* HEADER */}
          <div className="bg-navbar px-8 py-8 text-center">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Flame className="w-8 h-8 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h1 className="text-navbar-foreground text-2xl font-bold tracking-tight">ANH Bolivia</h1>
            <p className="text-navbar-muted text-sm mt-1">Sistema de Gestión de Combustible</p>
          </div>

          {/* FORM */}
          <div className="px-8 py-8">
            <div className="flex items-start gap-3 bg-state-warning-bg border border-state-warning-fg/20 text-state-warning-fg rounded-xl px-4 py-3 mb-6 text-sm">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Tu contraseña fue generada por un administrador. Por seguridad,
                debes elegir una nueva antes de continuar.
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Contraseña nueva
                </label>
                <div className="relative">
                  <input
                    type={verPass ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={passwordNuevo}
                    onChange={e => setPasswordNuevo(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {verPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{PASSWORD_HELP_TEXT}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Repetir contraseña nueva
                </label>
                <input
                  type={verPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={passwordNuevo2}
                  onChange={e => setPasswordNuevo2(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={guardando}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-slate-300 disabled:cursor-not-allowed text-primary-foreground font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {guardando
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <KeyRound className="w-4 h-4" />
                }
                {guardando ? "Guardando..." : "Guardar y continuar"}
              </button>

            </form>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground text-sm mt-6 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
