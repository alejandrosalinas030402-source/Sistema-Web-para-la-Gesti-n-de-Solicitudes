// src/components/ui/EstadoBadge.tsx

import { Badge } from "./Badge";
import {
  ESTADOS_SOLICITUD,
  ESTADOS_IDENTIDAD,
  ALERTAS_CONSUMIDOR,
  ESTADOS_CUENTA,
} from "../../utils/constants";

// ------------------------------------------------
// ESTADO DE SOLICITUD
// ------------------------------------------------

export function EstadoSolicitudBadge({ estado }: { estado: string }) {
  const config = ESTADOS_SOLICITUD[estado] ?? {
    label: estado,
    color: "bg-gray-100 text-gray-500",
  };
  return <Badge className={config.color}>{config.label}</Badge>;
}

// ------------------------------------------------
// ESTADO DE IDENTIDAD DEL CONSUMIDOR
// Pendiente = amarillo | En revisión = azul
// Verificado = verde   | Rechazado = rojo
// ------------------------------------------------

export function EstadoIdentidadBadge({ estado }: { estado: string }) {
  const config = ESTADOS_IDENTIDAD[estado] ?? {
    label: estado,
    color: "bg-gray-100 text-gray-500",
  };
  return <Badge className={config.color}>{config.label}</Badge>;
}

// ------------------------------------------------
// ALERTA DE REPETITIVIDAD DEL CONSUMIDOR
// Normal = gris neutro | En revisión = naranja | Bloqueado = rojo
// ------------------------------------------------

export function AlertaBadge({ alerta }: { alerta: string }) {
  const config = ALERTAS_CONSUMIDOR[alerta] ?? {
    label: alerta,
    color: "bg-gray-100 text-gray-500",
  };
  return <Badge className={config.color}>{config.label}</Badge>;
}

// ------------------------------------------------
// ESTADO DE CUENTA (User.estado_cuenta)
// Pendiente = amarillo | Activo = verde | Suspendido = rojo
// ------------------------------------------------

export function EstadoCuentaBadge({ estado }: { estado: string }) {
  const config = ESTADOS_CUENTA[estado] ?? {
    label: estado,
    color: "bg-gray-100 text-gray-500",
  };
  return <Badge className={config.color}>{config.label}</Badge>;
}