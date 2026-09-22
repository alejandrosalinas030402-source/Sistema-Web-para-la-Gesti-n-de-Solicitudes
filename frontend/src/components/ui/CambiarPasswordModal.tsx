// src/components/ui/CambiarPasswordModal.tsx

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Alert } from "./Alert";
import { authService } from "../../services/auth.service";
import { passwordSeguroSchema, PASSWORD_HELP_TEXT } from "../../utils/passwordSchema";
import { AlertCircle, CheckCircle, KeyRound, Eye, EyeOff } from "lucide-react";

interface Props {
  open:       boolean;
  onClose:    () => void;
  className?: string;
}

export function CambiarPasswordModal({ open, onClose, className = "" }: Props) {
  const [cambiando, setCambiando] = useState(false);
  const [error,     setError]     = useState("");
  const [exito,     setExito]     = useState(false);
  const [verPass,   setVerPass]   = useState(false);

  const [form, setForm] = useState({
    password_actual: "",
    password_nuevo:  "",
    password_nuevo2: "",
  });

  // Reinicia el formulario cada vez que se abre, igual que hacía
  // abrirModalPassword() en las páginas antes de la extracción.
  useEffect(() => {
    if (open) {
      setForm({ password_actual: "", password_nuevo: "", password_nuevo2: "" });
      setError("");
      setExito(false);
      setVerPass(false);
    }
  }, [open]);

  const cambiarPassword = async () => {
    setError("");

    if (!form.password_actual || !form.password_nuevo || !form.password_nuevo2) {
      setError("Completa los tres campos.");
      return;
    }

    const check = passwordSeguroSchema.safeParse(form.password_nuevo);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "La contraseña no cumple los requisitos.");
      return;
    }

    if (form.password_nuevo !== form.password_nuevo2) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    if (form.password_actual === form.password_nuevo) {
      setError("La contraseña nueva no puede ser igual a la actual.");
      return;
    }

    setCambiando(true);
    try {
      await authService.cambiarPassword(
        form.password_actual,
        form.password_nuevo,
        form.password_nuevo2,
      );
      // El backend invalida la sesión al cambiar la contraseña,
      // así que se muestra el aviso y se fuerza un nuevo login.
      setExito(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown } };
      const d = e.response?.data;
      let msg = "Error al cambiar la contraseña.";
      if (typeof d === "string") {
        msg = d;
      } else if (d && typeof d === "object") {
        const entries = Object.entries(d as Record<string, unknown>);
        if (entries.length > 0) {
          msg = entries
            .map(([, v]) => (Array.isArray(v) ? v[0] : String(v)))
            .join(" | ");
        }
      }
      setError(msg);
    } finally {
      setCambiando(false);
    }
  };

  // Recarga completa: limpia el estado en memoria del AuthContext
  // y lleva al login (las cookies ya fueron borradas por el backend).
  const volverAlLogin = () => {
    window.location.href = "/login";
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none";

  return (
    <Modal
      open={open}
      onClose={() => { if (!exito) onClose(); }}
      title={exito ? "" : "Cambiar contraseña"}
      size="sm"
    >
      <div className={className}>
        {exito ? (
          // Tras el cambio el backend cierra la sesión, así que no se
          // ofrece "cerrar" el modal: la única salida es volver al login.
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-state-success-bg flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-state-success-fg" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Contraseña actualizada</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Por seguridad, tu sesión se cerró. Inicia sesión nuevamente con tu contraseña nueva.
            </p>
            <Button variant="primary" onClick={volverAlLogin} className="w-full">
              Ir al inicio de sesión
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <Alert type="error" message={error} />}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Contraseña actual *
              </label>
              <input
                type={verPass ? "text" : "password"}
                value={form.password_actual}
                onChange={e => setForm(f => ({ ...f, password_actual: e.target.value }))}
                className={inputCls}
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Contraseña nueva *
              </label>
              <div className="relative">
                <input
                  type={verPass ? "text" : "password"}
                  value={form.password_nuevo}
                  onChange={e => setForm(f => ({ ...f, password_nuevo: e.target.value }))}
                  className={inputCls + " pr-10"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={verPass ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                >
                  {verPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{PASSWORD_HELP_TEXT}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Repetir contraseña nueva *
              </label>
              <input
                type={verPass ? "text" : "password"}
                value={form.password_nuevo2}
                onChange={e => setForm(f => ({ ...f, password_nuevo2: e.target.value }))}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Al cambiar la contraseña se cerrará tu sesión y deberás ingresar de nuevo.</span>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                icon={<KeyRound className="w-4 h-4" />}
                loading={cambiando}
                onClick={cambiarPassword}
              >
                Cambiar contraseña
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
