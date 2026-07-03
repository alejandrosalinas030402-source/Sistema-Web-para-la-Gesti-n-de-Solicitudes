// src/pages/anh/Consumidores.tsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { EstadoIdentidadBadge, AlertaBadge } from "../../components/ui/EstadoBadge";
import { consumidoresService } from "../../services/consumidores.service";
import type { ConsumidorPerfil } from "../../types/consumidor.types";
import { formatFecha } from "../../utils/format";
import {
  Users, Search, Plus, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";

// ------------------------------------------------
// CONSTANTES
// ------------------------------------------------

const TABS_IDENTIDAD = [
  { value: "",            label: "Todos" },
  { value: "PENDIENTE",   label: "Pendiente" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "VERIFICADO",  label: "Verificado" },
  { value: "RECHAZADO",   label: "Rechazado" },
];

const ALERTAS = [
  { value: "",            label: "Todas las alertas" },
  { value: "NORMAL",      label: "Normal" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "BLOQUEADO",   label: "Bloqueado" },
];

const POR_PAGINA = 15;

// ------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------

export default function ConsumidoresANH() {
  const navigate = useNavigate();

  const [consumidores, setConsumidores] = useState<ConsumidorPerfil[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [total,        setTotal]        = useState(0);

  const [estadoIdentidad, setEstadoIdentidad] = useState("");
  const [alerta,          setAlerta]          = useState("");
  const [busqueda,        setBusqueda]        = useState("");
  const [busquedaInput,   setBusquedaInput]   = useState("");
  const [pagina,          setPagina]          = useState(1);

  // ------------------------------------------------
  // CARGA DE DATOS
  // Búsqueda funciona DENTRO del tab activo + filtro de alerta:
  // los 3 params se envían al backend simultáneamente.
  // ------------------------------------------------

  const cargar = useCallback(async (
    paginaActual: number,
    identidadActual: string,
    alertaActual: string,
    busquedaActual: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = { page: String(paginaActual) };
      if (identidadActual) params.estado_identidad     = identidadActual;
      if (alertaActual)    params.alerta_repetitividad = alertaActual;
      if (busquedaActual)  params.search               = busquedaActual;

      const res = await consumidoresService.getAll(params);
      setConsumidores(res.results ?? (res as unknown as ConsumidorPerfil[]));
      setTotal((res as { count?: number }).count ?? 0);
    } catch {
      setError("Error al cargar los consumidores.");
      setConsumidores([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar(pagina, estadoIdentidad, alerta, busqueda);
  }, [pagina, estadoIdentidad, alerta, busqueda, cargar]);

  const onTabChange = (nuevoEstado: string) => {
    setEstadoIdentidad(nuevoEstado);
    setPagina(1);
  };

  const onAlertaChange = (nuevaAlerta: string) => {
    setAlerta(nuevaAlerta);
    setPagina(1);
  };

  const onBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setBusqueda(busquedaInput);
  };

  const onLimpiarBusqueda = () => {
    setBusquedaInput("");
    setBusqueda("");
    setPagina(1);
  };

  const totalPaginas = total > 0 ? Math.ceil(total / POR_PAGINA) : 1;

  return (
    <Layout>
      <div className="space-y-5">

        {/* TÍTULO */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navbar rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-navbar-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Consumidores</h1>
              <p className="text-muted-foreground text-sm">{total} registrados en total</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate("/admin/registrar-consumidor")}
            >
              Registrar consumidor
            </Button>
            <Button
              variant="outline"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => cargar(pagina, estadoIdentidad, alerta, busqueda)}
            >
              <span className="sr-only">Actualizar</span>
            </Button>
          </div>
        </div>

        {error && <Alert type="error" message={error} />}

        {/* TABLA CON TABS */}
        <Card>

          {/* TABS DE ESTADO DE IDENTIDAD */}
          <div className="flex items-center border-b border-border overflow-x-auto">
            {TABS_IDENTIDAD.map(tab => (
              <button
                key={tab.value}
                onClick={() => onTabChange(tab.value)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  estadoIdentidad === tab.value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* BÚSQUEDA + FILTRO DE ALERTA */}
          <div className="px-4 pt-4 pb-2 flex gap-2 flex-wrap">
            <form onSubmit={onBuscar} className="flex-1 flex gap-2 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={busquedaInput}
                  onChange={e => setBusquedaInput(e.target.value)}
                  placeholder={`Buscar${estadoIdentidad ? ` en ${TABS_IDENTIDAD.find(t => t.value === estadoIdentidad)?.label?.toLowerCase()}` : " por nombre, email o CI"}...`}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none"
                />
              </div>
              <Button variant="primary" size="md" type="submit">
                Buscar
              </Button>
              {busqueda && (
                <Button variant="outline" size="md" type="button" onClick={onLimpiarBusqueda}>
                  Limpiar
                </Button>
              )}
            </form>
            <select
              value={alerta}
              onChange={e => onAlertaChange(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border text-sm bg-input outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {ALERTAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {busqueda && (
            <p className="text-xs text-primary px-4 pb-2">
              Resultados para "<strong>{busqueda}</strong>"
              {estadoIdentidad && ` en ${TABS_IDENTIDAD.find(t => t.value === estadoIdentidad)?.label?.toLowerCase()}`}
            </p>
          )}

          {/* TABLA */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : consumidores.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-12 h-12 text-border mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">
                {busqueda ? "Sin resultados" : "Sin consumidores"}
              </p>
              <p className="text-muted-foreground text-sm">
                {busqueda
                  ? `No se encontraron consumidores para "${busqueda}"${estadoIdentidad ? ` en ${TABS_IDENTIDAD.find(t => t.value === estadoIdentidad)?.label?.toLowerCase()}` : ""}.`
                  : "No hay consumidores con este filtro."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Consumidor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Identidad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Alerta
                    </th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {consumidores.map(c => {
                    const nombre =
                      (c as any).nombre_completo ||
                      `${c.user?.nombres ?? ""} ${c.user?.apellido_paterno ?? ""}`.trim() ||
                      "—";
                    const email = (c as any).email || c.user?.email || "";
                    const municipio = c.municipio_nombre || "";
                    const fecha = formatFecha(c.fecha_creacion);
                    const esAlertaNormal = !c.alerta_repetitividad || c.alerta_repetitividad === "NORMAL";

                    const subtexto = [email, municipio, fecha].filter(Boolean).join(" · ");

                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/anh/consumidores/${c.id}`)}
                        className="hover:bg-background transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{nombre}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{subtexto}</p>
                        </td>
                        <td className="px-4 py-3">
                          <EstadoIdentidadBadge estado={c.estado_identidad} />
                        </td>
                        <td className="px-4 py-3">
                          {esAlertaNormal ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <AlertaBadge alerta={c.alerta_repetitividad} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINACIÓN */}
          {totalPaginas > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {pagina} de {totalPaginas} · {total} resultados
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ChevronLeft className="w-3.5 h-3.5" />}
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1 || loading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina >= totalPaginas || loading}
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}