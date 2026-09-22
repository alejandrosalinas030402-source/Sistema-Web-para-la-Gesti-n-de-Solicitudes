// src/pages/consumidor/MiPerfil.tsx

import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { consumidoresService } from "../../services/consumidores.service";
import { catalogosService } from "../../services/catalogos.service";
import type { ConsumidorPerfil, Departamento, Provincia, Municipio } from "../../types/consumidor.types";
import { EstadoIdentidadBadge, AlertaBadge } from "../../components/ui/EstadoBadge";
import { CambiarPasswordModal } from "../../components/ui/CambiarPasswordModal";
import { Button } from "../../components/ui/Button";
import { ACTIVIDADES } from "../../utils/constants";
import { formatFecha } from "../../utils/format";
import {
  User, MapPin, Briefcase, Shield, FileImage, Edit2, Check, X,
  AlertCircle, CheckCircle, KeyRound,
} from "lucide-react";

export default function MiPerfil() {
  const [perfil,       setPerfil]       = useState<ConsumidorPerfil | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [editando,     setEditando]     = useState(false);
  const [error,        setError]        = useState("");
  const [exito,        setExito]        = useState("");
  const [guardando,    setGuardando]    = useState(false);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [provincias,    setProvincias]    = useState<Provincia[]>([]);
  const [municipios,    setMunicipios]    = useState<Municipio[]>([]);

  const [form, setForm] = useState({
    celular: "", departamento: "", provincia: "", municipio: "",
    direccion: "", actividad: "",
  });

  // Cambio de contraseña — encapsulado en CambiarPasswordModal
  const [modalPassword, setModalPassword] = useState(false);

  // ------------------------------------------------
  // CARGA INICIAL
  // ------------------------------------------------

  useEffect(() => {
    consumidoresService.getMiPerfil().then(p => {
      setPerfil(p);
      setForm({
        celular:      p.celular,
        departamento: String(p.departamento ?? ""),
        provincia:    String(p.provincia ?? ""),
        municipio:    String(p.municipio ?? ""),
        direccion:    p.direccion,
        actividad:    p.actividad,
      });
    }).catch(() => setError("Error al cargar el perfil."))
    .finally(() => setLoading(false));

    catalogosService.getDepartamentos().then(setDepartamentos);
  }, []);

  const onDepartamento = async (id: string) => {
    setForm(f => ({ ...f, departamento: id, provincia: "", municipio: "" }));
    setMunicipios([]);
    if (id) setProvincias(await catalogosService.getProvincias(Number(id)));
  };

  const onProvincia = async (id: string) => {
    setForm(f => ({ ...f, provincia: id, municipio: "" }));
    if (id) setMunicipios(await catalogosService.getMunicipios(Number(id)));
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const actualizado = await consumidoresService.actualizarMiPerfil({
        celular:      form.celular,
        departamento: form.departamento ? Number(form.departamento) : null,
        provincia:    form.provincia    ? Number(form.provincia)    : null,
        municipio:    form.municipio    ? Number(form.municipio)    : null,
        direccion:    form.direccion,
        actividad:    form.actividad as ConsumidorPerfil["actividad"],
      });
      setPerfil(actualizado);
      setEditando(false);
      setExito("Perfil actualizado correctamente.");
    } catch {
      setError("Error al actualizar el perfil.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!perfil) return <Layout><p className="text-red-500">{error}</p></Layout>;

  const inputCls  = "w-full px-3 py-2 rounded-lg border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none";
  const selectCls = "w-full px-3 py-2 rounded-lg border border-border text-sm bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card outline-none";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>
            <p className="text-muted-foreground text-sm mt-1">Información de tu cuenta</p>
          </div>
          {!editando
            ? <button onClick={() => setEditando(true)} className="flex items-center gap-2 px-4 py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-background transition-colors">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
            : <div className="flex gap-2">
                <button onClick={() => setEditando(false)} className="flex items-center gap-2 px-3 py-2 border border-border text-muted-foreground rounded-xl text-sm hover:bg-background transition-colors">
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button onClick={guardar} disabled={guardando} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-hover disabled:bg-slate-300 transition-colors">
                  {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
          }
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {exito && (
          <div className="flex items-center gap-3 bg-state-success-bg border border-state-success-fg/20 text-state-success-fg rounded-xl px-4 py-3 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" /> {exito}
          </div>
        )}

        {/* DATOS PERSONALES */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Datos personales</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            {[
              ["Nombres",          perfil.user.nombres],
              ["Primer apellido",  perfil.user.apellido_paterno],
              ["Segundo apellido", perfil.user.apellido_materno || "—"],
              ["Correo",           perfil.user.email],
              ["Fecha nacimiento", formatFecha(perfil.fecha_nacimiento)],
            ].map(([label, valor]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="text-sm font-medium text-foreground">{valor}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Celular</p>
              {editando
                ? <input value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} className={inputCls} placeholder="Ej: 70000000" />
                : <p className="text-sm font-medium text-foreground">{perfil.celular || "—"}</p>
              }
            </div>
          </div>
        </div>

        {/* UBICACIÓN */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Ubicación</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            {editando ? (
              <>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Departamento</label>
                  <select value={form.departamento} onChange={e => onDepartamento(e.target.value)} className={selectCls}>
                    <option value="">Seleccionar...</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Provincia</label>
                  <select value={form.provincia} onChange={e => onProvincia(e.target.value)} className={selectCls} disabled={!provincias.length}>
                    <option value="">Seleccionar...</option>
                    {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Municipio</label>
                  <select value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} className={selectCls} disabled={!municipios.length}>
                    <option value="">Seleccionar...</option>
                    {municipios.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Dirección</label>
                  <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className={inputCls} maxLength={100} placeholder="Calle, N°, Barrio..." />
                </div>
              </>
            ) : (
              <>
                {[
                  ["Departamento", perfil.departamento_nombre || "—"],
                  ["Provincia",    perfil.provincia_nombre    || "—"],
                  ["Municipio",    perfil.municipio_nombre    || "—"],
                ].map(([label, valor]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-foreground">{valor}</p>
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Dirección</p>
                  <p className="text-sm font-medium text-foreground">{perfil.direccion || "—"}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ACTIVIDAD */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Actividad económica</h2>
          </div>
          <div className="px-6 py-4">
            {editando
              ? <select value={form.actividad} onChange={e => setForm(f => ({ ...f, actividad: e.target.value }))} className={selectCls}>
                  <option value="">Seleccionar...</option>
                  {Object.entries(ACTIVIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              : <p className="text-sm font-medium text-foreground">{perfil.actividad_display || "—"}</p>
            }
          </div>
        </div>

        {/* ESTADO */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Estado de cuenta</h2>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Verificación de identidad</p>
              <EstadoIdentidadBadge estado={perfil.estado_identidad} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Alerta de repetitividad</p>
              <AlertaBadge alerta={perfil.alerta_repetitividad} />
            </div>
          </div>
        </div>

        {/* SEGURIDAD */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Seguridad</h2>
          </div>
          <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-foreground">Contraseña</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cambia tu contraseña de acceso al sistema.
              </p>
            </div>
            <Button
              variant="outline"
              icon={<KeyRound className="w-4 h-4" />}
              onClick={() => setModalPassword(true)}
            >
              Cambiar contraseña
            </Button>
          </div>
        </div>

        {/* DOCUMENTOS */}
        {perfil.documentos.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <FileImage className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Documentos</h2>
            </div>
            {perfil.documentos.map(doc => (
              <div key={doc.id} className="px-6 py-4 border-b border-border last:border-0">
                <p className="text-sm font-medium text-foreground mb-1">{doc.tipo_documento_display}</p>
                <p className="text-xs text-muted-foreground">N°: {doc.numero_documento} {doc.complemento_documento}</p>
                <div className="flex gap-3 mt-3">
                  {doc.anverso && (
                    <a href={doc.anverso} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ver anverso</a>
                  )}
                  {doc.reverso && (
                    <a href={doc.reverso} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ver reverso</a>
                  )}
                  {doc.foto_sosteniendo && (
                    <a href={doc.foto_sosteniendo} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ver foto</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CambiarPasswordModal open={modalPassword} onClose={() => setModalPassword(false)} />
    </Layout>
  );
}