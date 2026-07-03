// src/services/estaciones.service.ts

import { api } from "../context/AuthContext";
import type { EstacionServicio } from "../types/estacion.types";

interface PaginatedResponse {
  results: EstacionServicio[];
  next: string | null;
}

async function fetchPage(
  url: string,
  params?: Record<string, string>
): Promise<PaginatedResponse> {
  const res = await api.get(url, params ? { params } : undefined);
  return res.data;
}

export const estacionesService = {

  // Trae solo la página que devuelva el backend (respeta PAGE_SIZE).
  // Se mantiene para usos que no necesitan el listado completo
  // (ej. el <select> de estaciones en los filtros de Reportes).
  getAll: async (params?: Record<string, string>): Promise<EstacionServicio[]> => {
    const res = await api.get("/api/estaciones/", { params });
    return res.data.results ?? res.data;
  },

  // Recorre todas las páginas de DRF (PageNumberPagination) y acumula
  // el listado completo. Necesario para la pantalla de Estaciones,
  // que agrupa por Departamento → Provincia → Municipio y por lo
  // tanto necesita ver todos los registros, no solo la primera página.
  getTodas: async (params?: Record<string, string>): Promise<EstacionServicio[]> => {
    let url: string | null = "/api/estaciones/";
    let currentParams: Record<string, string> | undefined = params;
    const acumulado: EstacionServicio[] = [];

    while (url) {
      const page = await fetchPage(url, currentParams);
      acumulado.push(...page.results);
      url = page.next;
      currentParams = undefined;
    }

    return acumulado;
  },

  getById: async (id: number): Promise<EstacionServicio> => {
    const res = await api.get(`/api/estaciones/${id}/`);
    return res.data;
  },

  crear: async (data: Partial<EstacionServicio>): Promise<EstacionServicio> => {
    const res = await api.post("/api/estaciones/", data);
    return res.data;
  },

  actualizar: async (
    id: number,
    data: Partial<EstacionServicio>
  ): Promise<EstacionServicio> => {
    const res = await api.put(`/api/estaciones/${id}/`, data);
    return res.data;
  },

  cambiarEstado: async (
    id: number,
    estado: string
  ): Promise<EstacionServicio> => {
    const res = await api.post(`/api/estaciones/${id}/cambiar-estado/`, { estado });
    return res.data;
  },
};