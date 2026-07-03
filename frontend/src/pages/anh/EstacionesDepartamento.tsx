// src/pages/anh/EstacionesDepartamento.tsx
// Nivel 2: Tarjetas de provincias dentro de un departamento

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { estacionesService } from "../../services/estaciones.service";
import { catalogosService } from "../../services/catalogos.service";
import type { EstacionServicio } from "../../types/estacion.types";
import { Card, CardBody } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Alert } from "../../components/ui/Alert";
import {
  Building2, ChevronRight, ArrowLeft, ArrowRight, MapPin, Search,
} from "lucide-react";

interface Prov { id: number; nombre: string; }

interface ProvStats {
  id: number;
  nombre: string;
  total: number;
  municipios: number;
  activas: number;
  inactivas: number;
  suspendidas: number;
}

export default function EstacionesDepartamento() {
  const { deptoId } = useParams<{ deptoId: string }>();
  const navigate = useNavigate();
  const deptoIdNum = Number(deptoId);

  const [estaciones, setEstaciones] = useState<EstacionServicio[]>([]);
  const [provincias, setProvincias] = useState<Prov[]>([]);
  const [deptoNombre, setDeptoNombre] = useState("");
  const [loading,  setLoading]  = useState(true);
  const [alerta,   setAlerta]   = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Cargar estaciones filtradas por departamento (el backend soporta este filtro)
        const data = await estacionesService.getTodas({
          municipio__provincia__departamento: String(deptoIdNum),
        });
        setEstaciones(data);

        // Nombre del departamento desde la primera estación, o desde catálogo
        if (data.length > 0) {
          setDeptoNombre(data[0].departamento_nombre);
        } else {
          const deptos = await catalogosService.getDepartamentos();
          const found = deptos.find((d: Prov) => d.id === deptoIdNum);
          setDeptoNombre(found?.nombre ?? `Departamento ${deptoId}`);
        }

        // Provincias del departamento desde catálogo
        const provs = await catalogosService.getProvincias(deptoIdNum);
        setProvincias(provs);
      } catch {
        setAlerta({ type: "error", message: "Error al cargar las estaciones del departamento." });
      } finally {
        setLoading(false);
      }
    })();
  }, [deptoIdNum, deptoId]);

  // Agrupar por provincia
  const provStats = useMemo((): ProvStats[] => {
    const lista = busqueda
      ? estaciones.filter(e => {
          const q = busqueda.toLowerCase();
          return (
            e.nombre.toLowerCase().includes(q) ||
            e.codigo.toLowerCase().includes(q) ||
            e.municipio_nombre.toLowerCase().includes(q)
          );
        })
      : estaciones;

    const mapa = new Map<number, ProvStats>();

    // Inicializar con todas las provincias del catálogo
    provincias.forEach(p => {
      mapa.set(p.id, { id: p.id, nombre: p.nombre, total: 0, municipios: 0, activas: 0, inactivas: 0, suspendidas: 0 });
    });

    // Contar estaciones y municipios únicos por provincia
    const munisPorProv = new Map<number, Set<number>>();

    lista.forEach(e => {
      if (!mapa.has(e.provincia_id)) {
        mapa.set(e.provincia_id, {
          id: e.provincia_id, nombre: `Provincia ${e.provincia_id}`,
          total: 0, municipios: 0, activas: 0, inactivas: 0, suspendidas: 0,
        });
      }
      const prov = mapa.get(e.provincia_id)!;
      prov.total++;
      if (e.estado === "ACTIVA")     prov.activas++;
      if (e.estado === "INACTIVA")   prov.inactivas++;
      if (e.estado === "SUSPENDIDA") prov.suspendidas++;

      if (!munisPorProv.has(e.provincia_id)) munisPorProv.set(e.provincia_id, new Set());
      munisPorProv.get(e.provincia_id)!.add(e.municipio);
    });

    munisPorProv.forEach((munis, provId) => {
      const prov = mapa.get(provId);
      if (prov) prov.municipios = munis.size;
    });

    const result = [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return busqueda ? result.filter(p => p.total > 0) : result;
  }, [estaciones, provincias, busqueda]);

  return (
    <Layout>
      <div className="space-y-5">

        {/* BREADCRUMB + TÍTULO */}
        <div>
          <button
            onClick={() => navigate("/anh/estaciones")}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Todos los departamentos
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navbar rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-navbar-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <span>Estaciones</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{deptoNombre}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{deptoNombre}</h1>
              <p className="text-muted-foreground text-sm">
                {estaciones.length} estaciones en {provincias.length} provincias
              </p>
            </div>
          </div>
        </div>

        {alerta && <Alert type={alerta.type} message={alerta.message} />}

        {/* BÚSQUEDA */}
        <Card>
          <CardBody className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar estación dentro de este departamento..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none"
              />
            </div>
          </CardBody>
        </Card>

        {/* TARJETAS DE PROVINCIAS */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : provStats.length === 0 ? (
          <Card>
            <CardBody className="text-center py-16">
              <Building2 className="w-12 h-12 text-border mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">Sin resultados</p>
              <p className="text-muted-foreground text-sm">No se encontraron estaciones en este departamento.</p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {provStats.map(prov => (
              <button
                key={prov.id}
                onClick={() => navigate(`/anh/estaciones/departamento/${deptoId}/provincia/${prov.id}`)}
                className={`group w-full text-left bg-card rounded-xl border border-border shadow-sm overflow-hidden
                  transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                  ${prov.total === 0 ? "opacity-60" : ""}`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-amber-700" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-lg font-bold text-foreground mb-1">{prov.nombre}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {prov.total} {prov.total === 1 ? "estación" : "estaciones"}
                    {prov.municipios > 0 && ` · ${prov.municipios} ${prov.municipios === 1 ? "municipio" : "municipios"}`}
                  </p>
                </div>
                {prov.total > 0 && (
                  <div className="px-5 py-3 border-t border-border flex gap-3">
                    {prov.activas > 0 && (
                      <span className="text-xs font-medium text-state-success-fg">{prov.activas} activa{prov.activas !== 1 ? "s" : ""}</span>
                    )}
                    {prov.inactivas > 0 && (
                      <span className="text-xs font-medium text-muted-foreground">{prov.inactivas} inactiva{prov.inactivas !== 1 ? "s" : ""}</span>
                    )}
                    {prov.suspendidas > 0 && (
                      <span className="text-xs font-medium text-red-600">{prov.suspendidas} suspendida{prov.suspendidas !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}