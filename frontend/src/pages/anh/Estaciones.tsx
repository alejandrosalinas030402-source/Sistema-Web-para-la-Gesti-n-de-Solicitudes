// src/pages/anh/Estaciones.tsx
// Nivel 1: Tarjetas de departamentos con conteo de estaciones

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { estacionesService } from "../../services/estaciones.service";
import { catalogosService } from "../../services/catalogos.service";
import type { EstacionServicio, EstadoEstacion } from "../../types/estacion.types";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { Modal } from "../../components/ui/Modal";
import {
  Building2, Plus, Search, RefreshCw, ArrowRight,
  CheckCircle, MapPin,
} from "lucide-react";

interface Depto { id: number; nombre: string; }
interface Prov  { id: number; nombre: string; }
interface Muni  { id: number; nombre: string; }

interface DeptStats {
  id: number;
  nombre: string;
  total: number;
  activas: number;
  inactivas: number;
  suspendidas: number;
}

export default function EstacionesANH() {
  const navigate = useNavigate();

  const [estaciones, setEstaciones] = useState<EstacionServicio[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [alerta,     setAlerta]     = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [busqueda,   setBusqueda]   = useState("");

  const [deptos, setDeptos] = useState<Depto[]>([]);
  const [provs,  setProvs]  = useState<Prov[]>([]);
  const [munis,  setMunis]  = useState<Muni[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);

  const [modal,     setModal]     = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [form, setForm] = useState({
    nombre: "", codigo: "", direccion: "",
    deptoId: 0, provId: 0, muniId: 0,
    estado: "ACTIVA" as EstadoEstacion,
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await estacionesService.getTodas();
      setEstaciones(data);
    } catch {
      setAlerta({ type: "error", message: "Error al cargar las estaciones." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    catalogosService.getDepartamentos().then(setDeptos).catch(() => {});
  }, []);

  // Agrupar por departamento con conteos
  const departamentos = useMemo((): DeptStats[] => {
    const mapa = new Map<number, DeptStats>();

    deptos.forEach(d => {
      mapa.set(d.id, { id: d.id, nombre: d.nombre, total: 0, activas: 0, inactivas: 0, suspendidas: 0 });
    });

    const lista = busqueda
      ? estaciones.filter(e => {
          const q = busqueda.toLowerCase();
          return (
            e.nombre.toLowerCase().includes(q) ||
            e.codigo.toLowerCase().includes(q) ||
            e.municipio_nombre.toLowerCase().includes(q) ||
            e.departamento_nombre.toLowerCase().includes(q)
          );
        })
      : estaciones;

    lista.forEach(e => {
      if (!mapa.has(e.departamento_id)) {
        mapa.set(e.departamento_id, {
          id: e.departamento_id, nombre: e.departamento_nombre,
          total: 0, activas: 0, inactivas: 0, suspendidas: 0,
        });
      }
      const dept = mapa.get(e.departamento_id)!;
      dept.total++;
      if (e.estado === "ACTIVA")     dept.activas++;
      if (e.estado === "INACTIVA")   dept.inactivas++;
      if (e.estado === "SUSPENDIDA") dept.suspendidas++;
    });

    const result = [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return busqueda ? result.filter(d => d.total > 0) : result;
  }, [estaciones, deptos, busqueda]);

  // Cascada del modal
  const onDeptoChange = async (deptoId: number) => {
    setForm(f => ({ ...f, deptoId, provId: 0, muniId: 0 }));
    setProvs([]); setMunis([]);
    if (!deptoId) return;
    setLoadingCatalogo(true);
    try { setProvs(await catalogosService.getProvincias(deptoId)); }
    finally { setLoadingCatalogo(false); }
  };

  const onProvChange = async (provId: number) => {
    setForm(f => ({ ...f, provId, muniId: 0 }));
    setMunis([]);
    if (!provId) return;
    setLoadingCatalogo(true);
    try { setMunis(await catalogosService.getMunicipios(provId)); }
    finally { setLoadingCatalogo(false); }
  };

  const abrirCrear = () => {
    setErrorForm("");
    setForm({ nombre: "", codigo: "", direccion: "", deptoId: 0, provId: 0, muniId: 0, estado: "ACTIVA" });
    setProvs([]); setMunis([]);
    setModal(true);
  };

  const guardar = async () => {
    if (!form.nombre || !form.codigo || !form.direccion || !form.muniId) {
      setErrorForm("Completa todos los campos obligatorios.");
      return;
    }
    setGuardando(true); setErrorForm("");
    try {
      await estacionesService.crear({
        nombre: form.nombre, codigo: form.codigo, direccion: form.direccion,
        municipio: form.muniId, estado: form.estado,
      });
      setAlerta({ type: "success", message: "Estación creada correctamente." });
      setModal(false);
      await cargar();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      const data = e.response?.data;
      if (data) {
        setErrorForm(Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(" | "));
      } else {
        setErrorForm("Error al guardar la estación.");
      }
    } finally { setGuardando(false); }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none";

  return (
    <Layout>
      <div className="space-y-5">

        {/* TÍTULO */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navbar rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-navbar-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Estaciones</h1>
              <p className="text-muted-foreground text-sm">{estaciones.length} estaciones en {deptos.length} departamentos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" icon={<RefreshCw className="w-4 h-4" />} onClick={cargar}>
              <span className="sr-only">Actualizar</span>
            </Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={abrirCrear}>
              Nueva estación
            </Button>
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
                placeholder="Buscar por nombre, código o municipio..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none"
              />
            </div>
          </CardBody>
        </Card>

        {/* TARJETAS DE DEPARTAMENTOS */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : departamentos.length === 0 ? (
          <Card>
            <CardBody className="text-center py-16">
              <Building2 className="w-12 h-12 text-border mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">Sin resultados</p>
              <p className="text-muted-foreground text-sm">No se encontraron estaciones para esta búsqueda.</p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departamentos.map(dept => (
              <button
                key={dept.id}
                onClick={() => navigate(`/anh/estaciones/departamento/${dept.id}`)}
                className={`group w-full text-left bg-card rounded-xl border border-border shadow-sm overflow-hidden
                  transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                  ${dept.total === 0 ? "opacity-60" : ""}`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-lg font-bold text-foreground mb-1">{dept.nombre}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {dept.total} {dept.total === 1 ? "estación" : "estaciones"}
                  </p>
                </div>
                {dept.total > 0 && (
                  <div className="px-5 py-3 border-t border-border flex gap-3">
                    {dept.activas > 0 && (
                      <span className="text-xs font-medium text-state-success-fg">{dept.activas} activa{dept.activas !== 1 ? "s" : ""}</span>
                    )}
                    {dept.inactivas > 0 && (
                      <span className="text-xs font-medium text-muted-foreground">{dept.inactivas} inactiva{dept.inactivas !== 1 ? "s" : ""}</span>
                    )}
                    {dept.suspendidas > 0 && (
                      <span className="text-xs font-medium text-red-600">{dept.suspendidas} suspendida{dept.suspendidas !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CREAR */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva estación" size="lg">
        <div className="space-y-4">
          {errorForm && <Alert type="error" message={errorForm} />}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Nombre de la estación" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Código *</label>
            <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} className={inputCls} placeholder="Ej: EST-001" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Departamento *</label>
            <select value={form.deptoId} onChange={e => onDeptoChange(Number(e.target.value))} className={inputCls}>
              <option value={0}>Seleccionar departamento...</option>
              {deptos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Provincia *</label>
            <select value={form.provId} onChange={e => onProvChange(Number(e.target.value))} disabled={!form.deptoId || loadingCatalogo} className={inputCls + " disabled:opacity-50"}>
              <option value={0}>{loadingCatalogo ? "Cargando..." : "Seleccionar provincia..."}</option>
              {provs.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Municipio *</label>
            <select value={form.muniId} onChange={e => setForm(f => ({ ...f, muniId: Number(e.target.value) }))} disabled={!form.provId || loadingCatalogo} className={inputCls + " disabled:opacity-50"}>
              <option value={0}>{loadingCatalogo ? "Cargando..." : "Seleccionar municipio..."}</option>
              {munis.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dirección *</label>
            <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className={inputCls} placeholder="Dirección completa" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button variant="primary" icon={<CheckCircle className="w-4 h-4" />} loading={guardando} onClick={guardar}>Crear estación</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}