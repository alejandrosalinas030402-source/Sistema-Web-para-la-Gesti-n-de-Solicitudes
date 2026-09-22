// src/components/ui/MostrarPasswordModal.tsx

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Alert } from "./Alert";
import { Copy, Check, Eye, EyeOff, Info } from "lucide-react";

interface Props {
  open:       boolean;
  onClose:    () => void;
  titulo:     string;
  email:      string;
  password:   string;
  className?: string;
}

// El llamador debe pasar key={password} (o algo que cambie con cada
// contraseña nueva): así React remonta el componente y passVisible/
// copiado arrancan en su valor inicial solos, sin un useEffect que
// los resetee — evita el anti-patrón "setState dentro de un efecto
// para reaccionar a un prop" (react-hooks/set-state-in-effect).
export function MostrarPasswordModal({ open, onClose, titulo, email, password, className = "" }: Props) {
  const [passVisible, setPassVisible] = useState(false);
  const [copiado,     setCopiado]     = useState(false);

  // Autocontenido: sin flash() de la página que lo abre (ahora hay
  // dos, con mecanismos propios), el feedback de "copiado" vive acá.
  const copiar = () => {
    navigator.clipboard.writeText(password);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none";

  return (
    <Modal open={open} onClose={onClose} title={titulo} size="md">
      <div className={`space-y-4 ${className}`}>
        <Alert type="warning" message="Guarda esta contraseña. Solo se muestra una vez y no podrás verla de nuevo." />

        <div>
          <p className="text-xs text-muted-foreground mb-1">Email</p>
          <p className="text-sm font-medium text-foreground">{email}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Contraseña provisional</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                readOnly
                type={passVisible ? "text" : "password"}
                value={password}
                className={inputCls + " font-mono pr-10"}
              />
              <button
                onClick={() => setPassVisible(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {passVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              icon={copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              onClick={copiar}
            >
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>El usuario deberá cambiar esta contraseña la próxima vez que inicie sesión.</span>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onClose}>Entendido, cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}
