// src/types/estacion.types.ts

export type EstadoEstacion = "ACTIVA" | "INACTIVA" | "SUSPENDIDA";

export interface EstacionServicio {
  id:        number;
  nombre:    string;
  codigo:    string;
  direccion: string;
  municipio: number;            // antes: string
  municipio_nombre: string;     // nuevo
  provincia_id: number;         // nuevo
  departamento_id: number;      // nuevo
  departamento_nombre: string;  // nuevo (antes "departamento": string)
  estado:    EstadoEstacion;
  // Solo en el listado (EstacionServicioListSerializer). El detalle
  // (EstacionServicioReadSerializer) trae el array `operadores`
  // completo en su lugar, no este conteo.
  operadores_count?: number;
}