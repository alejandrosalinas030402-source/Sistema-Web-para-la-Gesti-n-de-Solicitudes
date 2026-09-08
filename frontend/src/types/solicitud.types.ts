// src/types/solicitud.types.ts

export type EstadoSolicitud =
  | "PENDIENTE"
  | "OBSERVADA"
  | "APROBADA"
  | "DESPACHADA"
  | "RECHAZADA"
  | "CANCELADA"
  | "EXPIRADA";

export type TipoCombustible =
  | "GASOLINA"
  | "DIESEL"


export interface Solicitud {
  id_publico:                    string;
  estado:                        EstadoSolicitud;
  tipo_combustible:              TipoCombustible;
  litros_solicitados:            number;
  uso_combustible:               string;
  actividad:                     string;
  departamento:                  number | null;
  provincia:                     number | null;
  municipio:                     number | null;
  direccion:                     string;
  documento_justificativo:       string | null;
  documento_respuesta:           string | null;
  declaracion_jurada_confirmada: boolean;
  fecha_declaracion_jurada:      string | null;
  tipo_combustible_aprobado:     TipoCombustible | null;
  litros_aprobados:              number | null;
  litros_despachados:            number | null;
  observacion_anh:               string;
  estacion_servicio:             number | null;
  estacion_nombre:               string;
  fecha_creacion:                string;
  fecha_aprobacion:              string | null;
  fecha_expiracion:              string | null;
  fecha_despacho:                string | null;
  consumidor:                    ConsumidorResumen;

  // Auditoría de estados
  auditoria:                     AuditoriaEstado[];

  // Campos para respuesta de observación
  respuesta_consumidor:          string;
  fecha_observacion:             string | null;
  fecha_limite_respuesta:        string | null;
  horas_restantes_respuesta:     number | null;
  respuesta_plazo_vencido:       boolean;

  // Campos de listado (SolicitudListSerializer)
  consumidor_nombre?:            string;
  consumidor_email?:             string;
  departamento_nombre?:          string;
  provincia_nombre?:             string;
  municipio_nombre?:             string;
  consumidor_documento?:         string | null;
}

export interface ConsumidorResumen {
  id:              number;
  nombre_completo: string;
  email:           string;
}

export interface AuditoriaEstado {
  id:              number;
  estado_anterior: string;
  estado_nuevo:    string;
  usuario_nombre:  string;
  fecha:           string;
  ip_address:      string | null;
  nota:            string;
}

export interface SolicitudCreate {
  tipo_combustible:              TipoCombustible;
  litros_solicitados:            number;
  uso_combustible:               string;
  declaracion_jurada_confirmada: boolean;
  documento_justificativo?:      File | null;
  documento_respuesta?:          File | null;
  departamento:                  number;
  provincia:                     number;
  municipio:                     number;
  estacion_servicio:             number;
}