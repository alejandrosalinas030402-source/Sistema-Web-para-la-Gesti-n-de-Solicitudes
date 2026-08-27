// src/pages/anh/Dashboard.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { reportesService } from "../../services/reportes.service";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { ESTADOS_IDENTIDAD, ALERTAS_CONSUMIDOR } from "../../utils/constants";
import { formatLitros, } from "../../utils/format";
import {
  LayoutDashboard, FileText, Users, CheckCircle,
  Clock, AlertTriangle, TrendingUp, RefreshCw, ArrowRight,
} from "lucide-react";

// ------------------------------------------------
// TIPOS
// ------------------------------------------------

interface DashboardData {
  generado_en: string;
  solicitudes: {
    por_estado: {
      pendientes: number; observadas: number; aprobadas: number;
      despachadas: number; rechazadas: number; canceladas: number; expiradas: number;
    };
    hoy: { nuevas: number; despachos: number };
    mes_actual: {
      total: number; litros_solicitados: number;
      litros_aprobados: number; litros_despachados: number;
    };
    proximas_a_expirar: number;
  };
  consumidores: {
    total: number; verificados: number; pendientes_identidad: number;
    en_revision_identidad: number; bloqueados: number; en_revision_alerta: number;
  };
}

// ------------------------------------------------
// TARJETA-ATAJO
// Reemplaza al antiguo StatCard: ahora es un botón real que navega
// a la sección correspondiente, con acento de color por estado
// en el borde izquierdo (mismo criterio que ESTADOS_SOLICITUD).
// ------------------------------------------------

function ShortcutCard({
  label, value, sub, icon: Icon, iconBg, border, onClick,
}: {
  label: string; value: number | string; sub?: string;
  icon: any; iconBg: string; border: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left bg-card rounded-xl border border-border ${border} border-l-4 shadow-sm p-5
        transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-3xl font-bold text-foreground leading-tight">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </button>
  );
}

// ------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------

export default function DashboardANH() {
  const navigate = useNavigate();

  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const cargar = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await reportesService.getDashboard();
      setData(res);
    } catch {
      setError("No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    </Layout>
  );

  if (error || !data) return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-md mx-auto text-center">
        <Alert type="error" message={error || "No hay datos disponibles."} />
        <Button variant="primary" icon={<RefreshCw className="w-4 h-4" />} onClick={cargar}>
          Reintentar
        </Button>
      </div>
    </Layout>
  );

  const { solicitudes, consumidores } = data;

  // Datos para el bloque "Consumidores": cada fila usa el color
  // definido centralmente en ESTADOS_IDENTIDAD / ALERTAS_CONSUMIDOR,
  // en lugar de un color suelto elegido a mano.
  const filasConsumidores = [
    { label: "Total registrados",     value: consumidores.total,                colorClass: "bg-background text-foreground" },
    { label: "Verificados",           value: consumidores.verificados,          colorClass: ESTADOS_IDENTIDAD.VERIFICADO.color },
    { label: "Pend. verificación",    value: consumidores.pendientes_identidad, colorClass: ESTADOS_IDENTIDAD.PENDIENTE.color },
    { label: "En revisión identidad", value: consumidores.en_revision_identidad,colorClass: ESTADOS_IDENTIDAD.EN_REVISION.color },
    { label: "En revisión alerta",    value: consumidores.en_revision_alerta,   colorClass: ALERTAS_CONSUMIDOR.EN_REVISION.color },
    { label: "Bloqueados",            value: consumidores.bloqueados,           colorClass: ALERTAS_CONSUMIDOR.BLOQUEADO.color },
  ];

  const filasMes = [
    { label: "Total solicitudes",  value: solicitudes.mes_actual.total,              display: `${solicitudes.mes_actual.total}` },
    { label: "Litros solicitados", value: solicitudes.mes_actual.litros_solicitados, display: formatLitros(solicitudes.mes_actual.litros_solicitados) },
    { label: "Litros aprobados",   value: solicitudes.mes_actual.litros_aprobados,   display: formatLitros(solicitudes.mes_actual.litros_aprobados) },
    { label: "Litros despachados", value: solicitudes.mes_actual.litros_despachados, display: formatLitros(solicitudes.mes_actual.litros_despachados) },
  ];
  const baseMes = solicitudes.mes_actual.litros_solicitados || 1;

  return (
    <Layout>
      <div className="space-y-6">

        {/* TÍTULO */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navbar rounded-xl flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-navbar-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground text-xs">Actualizado: {data.generado_en}</p>
            </div>
          </div>
          <Button variant="outline" icon={<RefreshCw className="w-4 h-4" />} onClick={cargar}>
            Actualizar
          </Button>
        </div>

        {/* ATAJOS RÁPIDOS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ShortcutCard
            label="Nuevas hoy"
            value={solicitudes.hoy.nuevas}
            icon={FileText}
            iconBg="bg-primary/10 text-primary"
            border="border-l-primary"
            onClick={() => navigate("/anh/solicitudes")}
          />
          <ShortcutCard
            label="Despachos hoy"
            value={solicitudes.hoy.despachos}
            icon={CheckCircle}
            iconBg="bg-state-success-bg text-state-success-fg"
            border="border-l-green-500"
            onClick={() => navigate("/anh/solicitudes?estado=DESPACHADA")}
          />
          <ShortcutCard
            label="Pendientes"
            value={solicitudes.por_estado.pendientes}
            sub="Requieren revisión"
            icon={Clock}
            iconBg="bg-amber-100 text-amber-700"
            border="border-l-amber-500"
            onClick={() => navigate("/anh/solicitudes?estado=PENDIENTE")}
          />
          <ShortcutCard
            label="Por expirar"
            value={solicitudes.proximas_a_expirar}
            sub="Próximas 24h"
            icon={AlertTriangle}
            iconBg="bg-orange-100 text-orange-700"
            border="border-l-orange-500"
            onClick={() => navigate("/anh/solicitudes?proximas_a_expirar=true")}
          />
        </div>

        {/* CONSUMIDORES + MES ACTUAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Consumidores
              </h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {filasConsumidores.map(({ label, value, colorClass }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Badge className={colorClass}>{value}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Mes actual
              </h3>
            </CardHeader>
            <CardBody className="space-y-4">
              {filasMes.map(({ label, value, display }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-semibold text-foreground">{display}</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{ width: `${Math.min((value / baseMes) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </Layout>
  );
}