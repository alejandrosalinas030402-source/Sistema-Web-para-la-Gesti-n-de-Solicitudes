// src/services/users.service.ts

import { api } from "../context/AuthContext";

// ------------------------------------------------
// TIPOS (según respuesta real del backend)
// ------------------------------------------------

export type TipoUsuario  = "ANH" | "ESS" | "ADMIN" | "CONSUMIDOR";
export type EstadoCuenta = "ACTIVO" | "BLOQUEADO" | "INACTIVO" | "PENDIENTE_VERIFICACION";
export type TipoDocumento = "CI" | "CIE" | "PASAPORTE";

export interface PerfilFuncionario {
  id:                  number;
  cargo:               string;
  unidad_departamento: string;
  numero_funcionario:  string;
  numero_documento:    string;
  tipo_documento:      TipoDocumento;
  celular:             string;
  estacion_servicio_id: number | null;
  estacion_nombre:      string | null;
}

export interface UserFuncionario {
  id:                number;
  email:             string;
  nombres:           string;
  apellido_paterno:  string;
  apellido_materno:  string;
  nombre_completo:   string;
  tipo_usuario:      TipoUsuario;
  estado_cuenta:     EstadoCuenta;
  email_verificado:  boolean;
  date_joined:       string;
  perfil:            PerfilFuncionario | null;
}

// Payload para crear (según serializer del backend)
export interface CrearFuncionarioPayload {
  email:            string;
  nombres:          string;
  apellido_paterno: string;
  apellido_materno?: string;
  tipo_usuario:     "ANH" | "ESS" | "ADMIN";

  // Perfil (obligatorio para ESS y ANH según CrearFuncionarioSerializer)
  cargo?:               string;
  unidad_departamento?: string;
  numero_funcionario?:  string;
  numero_documento?:    string;
  tipo_documento?:      TipoDocumento;
  celular?:             string;
  estacion_servicio_id?: number;
}

export interface CrearFuncionarioResponse {
  message:  string;
  user_id:  number;
  email:    string;
  password_temporal: string;
  aviso:    string;
}

// Payload para editar
export interface EditarFuncionarioPayload {
  nombres?:          string;
  apellido_paterno?: string;
  apellido_materno?: string;
  // Perfil
  cargo?:               string;
  unidad_departamento?: string;
  numero_funcionario?:  string;
  numero_documento?:    string;
  tipo_documento?:      TipoDocumento;
  celular?:             string;
  estacion_servicio_id?: number | null;
}

// ------------------------------------------------
// SERVICE
// ------------------------------------------------

export const usersService = {

  // Retorna un array plano (el backend NO pagina este endpoint)
  listar: async (params?: Record<string, string>): Promise<UserFuncionario[]> => {
    const res = await api.get("/api/users/funcionarios/", { params });
    // Defensivo: por si algún día se pagina, aceptar ambas formas
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  },

  detalle: async (id: number): Promise<UserFuncionario> => {
    const res = await api.get(`/api/users/funcionarios/${id}/`);
    return res.data;
  },

  crear: async (payload: CrearFuncionarioPayload): Promise<CrearFuncionarioResponse> => {
    const res = await api.post("/api/users/funcionarios/crear/", payload);
    return res.data;
  },

  actualizar: async (id: number, payload: EditarFuncionarioPayload): Promise<UserFuncionario> => {
    const res = await api.patch(`/api/users/funcionarios/${id}/`, payload);
    return res.data;
  },

  cambiarEstado: async (id: number, estado: EstadoCuenta): Promise<UserFuncionario> => {
    const res = await api.post(`/api/users/funcionarios/${id}/cambiar-estado/`, {
      estado_cuenta: estado,
    });
    return res.data;
  },
};