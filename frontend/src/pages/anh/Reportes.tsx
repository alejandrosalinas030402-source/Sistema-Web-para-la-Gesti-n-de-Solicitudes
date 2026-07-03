// src/pages/anh/Reportes.tsx

import { useState, useEffect, useCallback, useRef } from "react";
import Layout from "../../components/Layout";
import { estacionesService } from "../../services/estaciones.service";
import { reportesService } from "../../services/reportes.service";
import { api } from "../../context/AuthContext";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { ESTADOS_SOLICITUD, ESTADOS_SOLICITUD_HEX } from "../../utils/constants";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  BarChart3, FileText, FileSpreadsheet, Filter,
} from "lucide-react";

// ------------------------------------------------
// CONSTANTES
// ------------------------------------------------

const FILTROS_CONSUMIDORES = [
  { value: "TODOS",            label: "Todos los consumidores" },
  { value: "BLOQUEADOS",       label: "Consumidores bloqueados" },
  { value: "EN_REVISION",      label: "Consumidores en revisión" },
  { value: "SUPERARON_LIMITE", label: "Superaron el límite" },
];

const ESTADOS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  ...Object.entries(ESTADOS_SOLICITUD).map(([value, { label }]) => ({ value, label })),
];

// Tiempo que un mensaje de alerta permanece visible antes de auto-ocultarse
const ALERT_TIMEOUT = 4000;

interface Estadisticas {
  total: number;
  litros: { solicitados: number; aprobados: number; despachados: number };
  por_estado:    { estado: string; total: number }[];
  por_estacion:  { estacion_nombre: string; total: number; litros_despachados: number }[];
  por_mes:       { mes: string; total: number; aprobadas: number; despachadas: number; litros: number }[];
  por_municipio: { municipio: string; total: number }[];
}

function Metrica({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardBody className="px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardBody>
    </Card>
  );
}

// Tooltip con el mismo lenguaje visual que el resto de las tarjetas,
// en vez del tooltip blanco por defecto de Recharts.
const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    fontSize: "12px",
  },
};

export default function ReportesANH() {
  const [tab, setTab] = useState<"solicitudes" | "consumidores">("solicitudes");

  const [fechaDesde,       setFechaDesde]       = useState("");
  const [fechaHasta,       setFechaHasta]       = useState("");
  const [estadoFiltro,     setEstadoFiltro]     = useState("");
  const [combustibleFiltro, setCombustibleFiltro] = useState("");
  const [estacionFiltro,   setEstacionFiltro]   = useState("");
  const [estaciones,       setEstaciones]       = useState<{ id: number; nombre: string }[]>([]);

  const [stats,      setStats]      = useState<Estadisticas | null>(null);
  const [loadStats,  setLoadStats]  = useState(false);

  // Alertas separadas por tab para que un mensaje de "Solicitudes"
  // no quede visible al cambiar a la pestaña "Consumidores" (y viceversa).
  const [alertaSol,  setAlertaSol]  = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [alertaCons, setAlertaCons] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const timerSolRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerConsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSol = (type: "error" | "success", message: string) => {
    setAlertaSol({ type, message });
    if (timerSolRef.current) clearTimeout(timerSolRef.current);
    timerSolRef.current = setTimeout(() => setAlertaSol(null), ALERT_TIMEOUT);
  };
  const flashCons = (type: "error" | "success", message: string) => {
    setAlertaCons({ type, message });
    if (timerConsRef.current) clearTimeout(timerConsRef.current);
    timerConsRef.current = setTimeout(() => setAlertaCons(null), ALERT_TIMEOUT);
  };

  // Formato que se está descargando en cada tab (para mostrar loading
  // solo en el botón correspondiente, no en los dos a la vez)
  const [descargandoSol,  setDescargandoSol]  = useState<"PDF" | "EXCEL" | null>(null);
  const [descargandoCons, setDescargandoCons] = useState<"PDF" | "EXCEL" | null>(null);

  const [filtroConsumidor, setFiltroConsumidor] = useState("TODOS");
  const [diasCons,         setDiasCons]         = useState(30);

  useEffect(() => {
    estacionesService.getAll({ estado: "ACTIVA" }).then(data => {
      const lista = Array.isArray(data) ? data : (data as any).results ?? [];
      setEstaciones(lista.map((e: any) => ({ id: e.id, nombre: e.nombre })));
    }).catch(() => {});
  }, []);

  const cargarEstadisticas = useCallback(async () => {
    setLoadStats(true);
    try {
      const params: Record<string, string> = {};
      if (fechaDesde)        params.fecha_desde  = fechaDesde;
      if (fechaHasta)        params.fecha_hasta  = fechaHasta;
      if (estadoFiltro)      params.estado       = estadoFiltro;
      if (combustibleFiltro) params.combustible  = combustibleFiltro;
      if (estacionFiltro)    params.estacion     = estacionFiltro;

      const res = await api.get("/api/estadisticas/solicitudes/", { params });
      setStats(res.data);
    } catch {
      flashSol("error", "No se pudieron cargar las estadísticas.");
    } finally {
      setLoadStats(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, estadoFiltro, combustibleFiltro, estacionFiltro]);

  // Los filtros se aplican automáticamente al cambiar cualquiera de ellos
  // (ya no hay botón "Aplicar" separado: evita el paso extra y la
  // confusión de un botón que en la práctica no era necesario).
  useEffect(() => {
    if (tab === "solicitudes") cargarEstadisticas();
  }, [tab, cargarEstadisticas]);

  const descargarSolicitudes = async (destFormato: "PDF" | "EXCEL") => {
    setDescargandoSol(destFormato);
    try {
      const params: Record<string, string> = { formato: destFormato };
      if (fechaDesde)        params.fecha_desde = fechaDesde;
      if (fechaHasta)        params.fecha_hasta = fechaHasta;
      if (estadoFiltro)      params.estado      = estadoFiltro;
      if (combustibleFiltro) params.combustible = combustibleFiltro;
      if (estacionFiltro)    params.estacion    = estacionFiltro;

      const res = await api.get("/api/reportes/solicitudes/", {
        params,
        responseType: "blob",
      });

      const ext  = destFormato === "PDF" ? "pdf" : "xlsx";
      const url  = URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `reporte_solicitudes.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      flashSol("success", `Reporte ${destFormato} descargado correctamente.`);
    } catch {
      flashSol("error", "Ocurrió un error al generar el reporte.");
    } finally {
      setDescargandoSol(null);
    }
  };

  const descargarConsumidores = async (destFormato: "PDF" | "EXCEL") => {
    setDescargandoCons(destFormato);
    try {
      await reportesService.descargar(filtroConsumidor, destFormato, diasCons);
      flashCons("success", `Reporte de consumidores ${destFormato} descargado.`);
    } catch {
      flashCons("error", "Ocurrió un error al generar el reporte.");
    } finally {
      setDescargandoCons(null);
    }
  };

  const inputCls = "px-3 py-2 rounded-xl border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none";

  return (
    <Layout>
      <div className="space-y-5">

        {/* TÍTULO */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-navbar rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-navbar-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
            <p className="text-muted-foreground text-sm">Estadísticas y reportes del sistema ANH</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setTab("solicitudes")}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
              tab === "solicitudes"
                ? "bg-navbar text-navbar-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Solicitudes
          </button>
          <button
            onClick={() => setTab("consumidores")}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
              tab === "consumidores"
                ? "bg-navbar text-navbar-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Consumidores
          </button>
        </div>

        {/* TAB SOLICITUDES */}
        {tab === "solicitudes" && (
          <div className="space-y-5">

            {alertaSol && <Alert type={alertaSol.type} message={alertaSol.message} />}

            {/* FILTROS (se aplican automáticamente al cambiar) */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Filtros</span>
                  {loadStats && <Spinner size="sm" />}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Desde</label>
                    <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Hasta</label>
                    <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Estado</label>
                    <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} className={inputCls}>
                      {ESTADOS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Combustible</label>
                    <select value={combustibleFiltro} onChange={e => setCombustibleFiltro(e.target.value)} className={inputCls}>
                      <option value="">Todos</option>
                      <option value="GASOLINA">Gasolina</option>
                      <option value="DIESEL">Diésel</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Estación</label>
                    <select value={estacionFiltro} onChange={e => setEstacionFiltro(e.target.value)} className={inputCls}>
                      <option value="">Todas</option>
                      {estaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* MÉTRICAS Y GRÁFICOS */}
            {stats && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Metrica label="Total solicitudes"  value={stats.total} />
                  <Metrica label="Litros solicitados" value={`${stats.litros.solicitados.toLocaleString()} L`} />
                  <Metrica label="Litros aprobados"   value={`${stats.litros.aprobados.toLocaleString()} L`} />
                  <Metrica label="Litros despachados" value={`${stats.litros.despachados.toLocaleString()} L`} />
                </div>

                {stats.total === 0 ? (
                  <Card>
                    <CardBody className="text-center py-12">
                      <p className="text-foreground font-medium mb-1">No hay solicitudes para estos filtros</p>
                      <p className="text-muted-foreground text-sm">Ajusta el rango de fechas o el estado seleccionado e inténtalo de nuevo.</p>
                    </CardBody>
                  </Card>
                ) : (
                  <>
                    {/* Por estado — Pie */}
                    <Card>
                      <CardHeader><h3 className="font-semibold text-foreground text-sm">Solicitudes por estado</h3></CardHeader>
                      <CardBody>
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={stats.por_estado}
                              dataKey="total"
                              nameKey="estado"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ estado, total }) => `${ESTADOS_SOLICITUD[estado]?.label ?? estado}: ${total}`}
                              labelLine={false}
                            >
                              {stats.por_estado.map((entry, i) => (
                                <Cell key={i} fill={ESTADOS_SOLICITUD_HEX[entry.estado] ?? "#CBD5E1"} />
                              ))}
                            </Pie>
                            <Tooltip {...tooltipStyle} formatter={(v) => [`${v} solicitudes`]} />
                            <Legend formatter={(v) => ESTADOS_SOLICITUD[v]?.label ?? v} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>

                    {/* Evolución mensual */}
                    {stats.por_mes.length > 0 && (
                      <Card>
                        <CardHeader><h3 className="font-semibold text-foreground text-sm">Evolución mensual (últimos 12 meses)</h3></CardHeader>
                        <CardBody>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={stats.por_mes} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip {...tooltipStyle} />
                              <Legend />
                              <Line type="monotone" dataKey="total"       name="Total"       stroke="#17212B" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="aprobadas"   name="Aprobadas"   stroke={ESTADOS_SOLICITUD_HEX.APROBADA}   strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="despachadas" name="Despachadas" stroke={ESTADOS_SOLICITUD_HEX.DESPACHADA} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardBody>
                      </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {stats.por_estacion.length > 0 && (
                        <Card>
                          <CardHeader><h3 className="font-semibold text-foreground text-sm">Top estaciones de servicio</h3></CardHeader>
                          <CardBody>
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={stats.por_estacion} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis dataKey="estacion_nombre" type="category" tick={{ fontSize: 10 }} width={120} />
                                <Tooltip {...tooltipStyle} />
                                <Bar dataKey="total" name="Solicitudes" fill={ESTADOS_SOLICITUD_HEX.APROBADA} radius={[0,4,4,0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardBody>
                        </Card>
                      )}

                      {stats.por_municipio.length > 0 && (
                        <Card>
                          <CardHeader><h3 className="font-semibold text-foreground text-sm">Top municipios</h3></CardHeader>
                          <CardBody>
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={stats.por_municipio} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis dataKey="municipio" type="category" tick={{ fontSize: 10 }} width={100} />
                                <Tooltip {...tooltipStyle} />
                                <Bar dataKey="total" name="Solicitudes" fill={ESTADOS_SOLICITUD_HEX.PENDIENTE} radius={[0,4,4,0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardBody>
                        </Card>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {loadStats && !stats && (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
              </div>
            )}

            {/* DESCARGA — un clic por formato, sin paso intermedio de selección */}
            <div className="bg-navbar rounded-2xl p-6 text-navbar-foreground">
              <h3 className="font-semibold mb-1">Descargar reporte de solicitudes</h3>
              <p className="text-navbar-muted text-xs mb-4">
                Se descarga con los mismos filtros aplicados arriba.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                  loading={descargandoSol === "EXCEL"}
                  disabled={descargandoSol !== null}
                  onClick={() => descargarSolicitudes("EXCEL")}
                  className="flex-1"
                >
                  Descargar Excel
                </Button>
                <Button
                  variant="secondary"
                  icon={<FileText className="w-4 h-4" />}
                  loading={descargandoSol === "PDF"}
                  disabled={descargandoSol !== null}
                  onClick={() => descargarSolicitudes("PDF")}
                  className="flex-1"
                >
                  Descargar PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONSUMIDORES */}
        {tab === "consumidores" && (
          <div className="max-w-2xl space-y-5">

            {alertaCons && <Alert type={alertaCons.type} message={alertaCons.message} />}

            <Card>
              <CardHeader><h2 className="font-semibold text-foreground">Reporte de consumidores</h2></CardHeader>
              <CardBody className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Tipo de reporte</label>
                  <div className="grid grid-cols-1 gap-2">
                    {FILTROS_CONSUMIDORES.map(f => (
                      <label key={f.value} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        filtroConsumidor === f.value ? "border-primary bg-primary/10" : "border-border hover:bg-background"
                      }`}>
                        <input type="radio" name="filtro_cons" value={f.value} checked={filtroConsumidor === f.value}
                          onChange={() => setFiltroConsumidor(f.value)} className="text-primary accent-primary" />
                        <p className={`text-sm font-medium ${filtroConsumidor === f.value ? "text-primary" : "text-foreground"}`}>
                          {f.label}
                        </p>
                      </label>
                    ))}
                  </div>
                </div>

                {filtroConsumidor === "SUPERARON_LIMITE" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Período (días)</label>
                    <div className="flex gap-2 flex-wrap">
                      {[7, 15, 30, 60, 90].map(d => (
                        <button key={d} onClick={() => setDiasCons(d)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                            diasCons === d ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-background"
                          }`}>
                          {d} días
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="bg-navbar rounded-2xl p-6 text-navbar-foreground">
              <h3 className="font-semibold mb-1">Resumen</h3>
              <p className="text-navbar-muted text-sm mb-4">
                {FILTROS_CONSUMIDORES.find(f => f.value === filtroConsumidor)?.label}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                  loading={descargandoCons === "EXCEL"}
                  disabled={descargandoCons !== null}
                  onClick={() => descargarConsumidores("EXCEL")}
                  className="flex-1"
                >
                  Descargar Excel
                </Button>
                <Button
                  variant="secondary"
                  icon={<FileText className="w-4 h-4" />}
                  loading={descargandoCons === "PDF"}
                  disabled={descargandoCons !== null}
                  onClick={() => descargarConsumidores("PDF")}
                  className="flex-1"
                >
                  Descargar PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}