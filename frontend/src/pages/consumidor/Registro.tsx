// src/pages/consumidor/Registro.tsx

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authService } from "../../services/auth.service";
import { catalogosService } from "../../services/catalogos.service";
import type { Departamento, Provincia, Municipio } from "../../types/consumidor.types";
import { ACTIVIDADES, TIPOS_DOCUMENTO } from "../../utils/constants";
import { passwordSeguroSchema, PASSWORD_HELP_TEXT } from "../../utils/passwordSchema";
import { Flame, ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Upload, Eye, EyeOff } from "lucide-react";

// ------------------------------------------------
// SCHEMAS POR PASO
// ------------------------------------------------

const paso1Schema = z.object({
  tipo_documento:   z.string().min(1, "Selecciona el tipo de documento"),
  numero_documento: z.string()
    .min(7, "El número de documento debe tener mínimo 7 dígitos")
    .max(9, "El número de documento debe tener máximo 9 dígitos")
    .regex(/^[0-9]+$/, "El número de documento solo debe contener dígitos"),
  complemento_documento: z.string()
    .max(10, "El complemento es demasiado largo")
    .regex(/^[a-zA-Z0-9\-]*$/, "Solo letras, números y guión")
    .optional(),
  nombres:          z.string()
    .min(2, "Ingresa tus nombres")
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]+$/, "Solo se permiten letras"),
  apellido_paterno: z.string()
    .min(2, "Ingresa tu primer apellido")
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]+$/, "Solo se permiten letras"),
  apellido_materno: z.string()
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]*$/, "Solo se permiten letras")
    .optional(),
  fecha_nacimiento: z.string().min(1, "Ingresa tu fecha de nacimiento"),
});

const paso2Schema = z.object({
  email:        z.string().email("Email inválido"),
  celular:      z.string().min(7, "Ingresa tu número de celular"),
  departamento: z.string().min(1, "Selecciona un departamento"),
  provincia:    z.string().min(1, "Selecciona una provincia"),
  municipio:    z.string().min(1, "Selecciona un municipio"),
  actividad:    z.string().min(1, "Selecciona una actividad"),
  actividad_otro: z.string().max(100, "Máximo 100 caracteres").optional(),
  direccion:    z.string().min(5, "Ingresa tu dirección").max(100),
}).refine(
  (data) => data.actividad !== "OTRO" || (data.actividad_otro && data.actividad_otro.trim().length >= 3),
  {
    message: "Describe tu actividad (mínimo 3 caracteres)",
    path: ["actividad_otro"],
  }
);

const paso3Schema = z.object({
  password:  passwordSeguroSchema,
  password2: z.string().min(1, "Repite la contraseña"),
}).refine(d => d.password === d.password2, {
  message: "Las contraseñas no coinciden",
  path: ["password2"],
});

type Paso1Data = z.infer<typeof paso1Schema>;
type Paso2Data = z.infer<typeof paso2Schema>;
type Paso3Data = z.infer<typeof paso3Schema>;

// ------------------------------------------------
// COMPONENTE PASO INDICADOR
// ------------------------------------------------

function PasoIndicador({ actual }: { actual: number }) {
  const pasos = ["Identidad", "Datos", "Contraseña", "Documentos"];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {pasos.map((label, i) => {
        const num      = i + 1;
        const activo   = num === actual;
        const completo = num < actual;
        return (
          <div key={num} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                completo ? "bg-primary text-primary-foreground" :
                activo   ? "bg-navbar text-navbar-foreground" :
                           "bg-border text-muted-foreground"
              }`}>
                {completo ? <CheckCircle className="w-4 h-4" /> : num}
              </div>
              <span className={`text-xs hidden sm:block ${activo ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mb-4 ${num < actual ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------

export default function Registro() {
  const navigate = useNavigate();
  const [paso, setPaso]       = useState(1);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [provincias,    setProvincias]    = useState<Provincia[]>([]);
  const [municipios,    setMunicipios]    = useState<Municipio[]>([]);

  const [anverso,         setAnverso]         = useState<File | null>(null);
  const [reverso,         setReverso]         = useState<File | null>(null);
  const [fotoSosteniendo, setFotoSosteniendo] = useState<File | null>(null);

  const [datosPaso1, setDatosPaso1] = useState<Paso1Data | null>(null);
  const [datosPaso2, setDatosPaso2] = useState<Paso2Data | null>(null);

  const [showPass,  setShowPass]  = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  useEffect(() => {
    catalogosService.getDepartamentos().then(setDepartamentos);
  }, []);

  const form1 = useForm<Paso1Data>({ resolver: zodResolver(paso1Schema) });
  const form2 = useForm<Paso2Data>({ resolver: zodResolver(paso2Schema) });
  const form3 = useForm<Paso3Data>({ resolver: zodResolver(paso3Schema) });

  const actividadSeleccionada = form2.watch("actividad");

  const onChangeDepartamento = async (id: string) => {
    form2.setValue("provincia", "");
    form2.setValue("municipio", "");
    setMunicipios([]);
    if (id) {
      const provs = await catalogosService.getProvincias(Number(id));
      setProvincias(provs);
    }
  };

  const onChangeProvincia = async (id: string) => {
    form2.setValue("municipio", "");
    if (id) {
      const muns = await catalogosService.getMunicipios(Number(id));
      setMunicipios(muns);
    }
  };

  const submitPaso1 = form1.handleSubmit((data) => {
    setDatosPaso1(data);
    setPaso(2);
    setError("");
  });

  const submitPaso2 = form2.handleSubmit((data) => {
    setDatosPaso2(data);
    setPaso(3);
    setError("");
  });

  const submitPaso3 = form3.handleSubmit(() => {
    setPaso(4);
    setError("");
  });

  const submitFinal = async () => {
    if (!anverso || !reverso || !fotoSosteniendo) {
      setError("Debes subir las 3 fotografías del documento.");
      return;
    }
    if (!datosPaso1 || !datosPaso2) return;

    const pass3 = form3.getValues();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("tipo_documento",       datosPaso1.tipo_documento);
      formData.append("numero_documento",      datosPaso1.numero_documento);
      formData.append("complemento_documento", datosPaso1.complemento_documento ?? "");
      formData.append("nombres",               datosPaso1.nombres);
      formData.append("apellido_paterno",      datosPaso1.apellido_paterno);
      formData.append("apellido_materno",      datosPaso1.apellido_materno ?? "");
      formData.append("fecha_nacimiento",      datosPaso1.fecha_nacimiento);

      formData.append("email",        datosPaso2.email);
      formData.append("celular",      datosPaso2.celular);
      formData.append("departamento", datosPaso2.departamento);
      formData.append("provincia",    datosPaso2.provincia);
      formData.append("municipio",    datosPaso2.municipio);
      formData.append("direccion",    datosPaso2.direccion);

      if (datosPaso2.actividad === "OTRO" && datosPaso2.actividad_otro) {
        formData.append("actividad", datosPaso2.actividad_otro.trim());
      } else {
        formData.append("actividad", datosPaso2.actividad);
      }

      formData.append("password",  pass3.password);
      formData.append("password2", pass3.password2);

      formData.append("anverso",          anverso);
      formData.append("reverso",          reverso);
      formData.append("foto_sosteniendo", fotoSosteniendo);

      await authService.registro(formData);
      navigate(`/verificar-email?email=${encodeURIComponent(datosPaso2.email)}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      const data = e.response?.data;
      if (data) {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
          .join(" | ");
        setError(msgs);
      } else {
        setError("Error al registrarse. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------
  // INPUT HELPERS
  // ------------------------------------------------

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none ${
      hasError
        ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
        : "border-border bg-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card"
    }`;

  const selectClass = (hasError: boolean) =>
    `w-full px-4 py-2.5 rounded-xl border text-sm outline-none bg-input ${
      hasError ? "border-red-300" : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
    }`;

  const FileInput = ({
    label, file, onChange, required = true
  }: {
    label: string;
    file: File | null;
    onChange: (f: File) => void;
    required?: boolean;
  }) => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
        file ? "border-primary bg-state-success-bg" : "border-border bg-input hover:bg-background"
      }`}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => e.target.files?.[0] && onChange(e.target.files[0])}
        />
        {file ? (
          <div className="text-center">
            <CheckCircle className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-xs text-state-success-fg font-medium truncate max-w-[160px]">{file.name}</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">JPG, PNG o WebP — máx 5MB</p>
          </div>
        )}
      </label>
    </div>
  );

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-navbar via-[#1f2d3d] to-navbar flex items-center justify-center p-4">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-navbar px-8 py-6 text-center">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <Flame className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h1 className="text-navbar-foreground text-xl font-bold">Crear cuenta</h1>
            <p className="text-navbar-muted text-xs mt-1">ANH Bolivia — Consumidor</p>
          </div>

          <div className="px-8 py-6">
            <PasoIndicador actual={paso} />

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ---- PASO 1 — DATOS DE IDENTIDAD ---- */}
            {paso === 1 && (
              <form onSubmit={submitPaso1} className="space-y-4">
                <h3 className="font-semibold text-foreground text-sm mb-3">Datos de identidad</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de documento *</label>
                    <select {...form1.register("tipo_documento")} className={selectClass(!!form1.formState.errors.tipo_documento)}>
                      <option value="">Seleccionar...</option>
                      {TIPOS_DOCUMENTO.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {form1.formState.errors.tipo_documento && <p className="text-red-500 text-xs mt-1">{form1.formState.errors.tipo_documento.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">N° Documento *</label>
                    <input {...form1.register("numero_documento")} placeholder="Ej: 12345678" inputMode="numeric" maxLength={9} onInput={(e) => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, ""); }} className={inputClass(!!form1.formState.errors.numero_documento)} />
                    {form1.formState.errors.numero_documento && <p className="text-red-500 text-xs mt-1">{form1.formState.errors.numero_documento.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Complemento</label>
                    <input {...form1.register("complemento_documento")} placeholder="Ej: 1A" className={inputClass(false)} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Nombres *</label>
                    <input {...form1.register("nombres", { onChange: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-záéíóúüñ ]/g, ""); } })} placeholder="Tus nombres" className={inputClass(!!form1.formState.errors.nombres)} />
                    {form1.formState.errors.nombres && <p className="text-red-500 text-xs mt-1">{form1.formState.errors.nombres.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Primer apellido *</label>
                    <input {...form1.register("apellido_paterno", { onChange: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-záéíóúüñ ]/g, ""); } })} placeholder="Primer apellido" className={inputClass(!!form1.formState.errors.apellido_paterno)} />
                    {form1.formState.errors.apellido_paterno && <p className="text-red-500 text-xs mt-1">{form1.formState.errors.apellido_paterno.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Segundo apellido</label>
                    <input {...form1.register("apellido_materno", { onChange: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-záéíóúüñ ]/g, ""); } })} placeholder="Segundo apellido" className={inputClass(false)} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha de nacimiento *</label>
                    <input type="date" {...form1.register("fecha_nacimiento")} className={inputClass(!!form1.formState.errors.fecha_nacimiento)} />
                    {form1.formState.errors.fecha_nacimiento && <p className="text-red-500 text-xs mt-1">{form1.formState.errors.fecha_nacimiento.message}</p>}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* ---- PASO 2 — DATOS GENERALES ---- */}
            {paso === 2 && (
              <form onSubmit={submitPaso2} className="space-y-4">
                <h3 className="font-semibold text-foreground text-sm mb-3">Datos generales</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Correo electrónico *</label>
                    <input type="email" {...form2.register("email", { onChange: e => { e.target.value = e.target.value.toLowerCase(); } })} placeholder="ejemplo@correo.com" className={inputClass(!!form2.formState.errors.email)} />
                    {form2.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form2.formState.errors.email.message}</p>}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Celular *</label>
                    <input {...form2.register("celular")} placeholder="Ej: 70000000" className={inputClass(!!form2.formState.errors.celular)} />
                    {form2.formState.errors.celular && <p className="text-red-500 text-xs mt-1">{form2.formState.errors.celular.message}</p>}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Departamento *</label>
                    <select {...form2.register("departamento")} onChange={e => { form2.setValue("departamento", e.target.value); onChangeDepartamento(e.target.value); }} className={selectClass(!!form2.formState.errors.departamento)}>
                      <option value="">Seleccionar...</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                    {form2.formState.errors.departamento && <p className="text-red-500 text-xs mt-1">{form2.formState.errors.departamento.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Provincia *</label>
                    <select {...form2.register("provincia")} onChange={e => { form2.setValue("provincia", e.target.value); onChangeProvincia(e.target.value); }} className={selectClass(!!form2.formState.errors.provincia)} disabled={provincias.length === 0}>
                      <option value="">Seleccionar...</option>
                      {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    {form2.formState.errors.provincia && <p className="text-red-500 text-xs mt-1">{form2.formState.errors.provincia.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Municipio *</label>
                    <select {...form2.register("municipio")} className={selectClass(!!form2.formState.errors.municipio)} disabled={municipios.length === 0}>
                      <option value="">Seleccionar...</option>
                      {municipios.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                    {form2.formState.errors.municipio && <p className="text-red-500 text-xs mt-1">{form2.formState.errors.municipio.message}</p>}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Actividad económica *</label>
                    <select {...form2.register("actividad")} className={selectClass(!!form2.formState.errors.actividad)}>
                      <option value="">Seleccionar...</option>
                      {Object.entries(ACTIVIDADES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    {form2.formState.errors.actividad && <p className="text-red-500 text-xs mt-1">{form2.formState.errors.actividad.message}</p>}
                  </div>

                  {actividadSeleccionada === "OTRO" && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Especifica tu actividad *
                      </label>
                      <input
                        {...form2.register("actividad_otro")}
                        placeholder="Describe tu actividad económica..."
                        maxLength={100}
                        className={inputClass(!!form2.formState.errors.actividad_otro)}
                        autoFocus
                      />
                      {form2.formState.errors.actividad_otro && (
                        <p className="text-red-500 text-xs mt-1">
                          {form2.formState.errors.actividad_otro.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Ejemplo: "Apicultura", "Artesanía", "Turismo"
                      </p>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Dirección *</label>
                    <input {...form2.register("direccion")} placeholder="Calle, N°, Barrio..." maxLength={100} className={inputClass(!!form2.formState.errors.direccion)} />
                    {form2.formState.errors.direccion && <p className="text-red-500 text-xs mt-1">{form2.formState.errors.direccion.message}</p>}
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => setPaso(1)} className="flex items-center gap-2 px-4 py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-background transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* ---- PASO 3 — CONTRASEÑA ---- */}
            {paso === 3 && (
              <form onSubmit={submitPaso3} className="space-y-4">
                <h3 className="font-semibold text-foreground text-sm mb-3">Contraseña de acceso</h3>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Contraseña *</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} {...form3.register("password")} placeholder="Mínimo 8 caracteres" className={inputClass(!!form3.formState.errors.password) + " pr-11"} />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form3.formState.errors.password
                    ? <p className="text-red-500 text-xs mt-1">{form3.formState.errors.password.message}</p>
                    : <p className="text-xs text-muted-foreground mt-1">{PASSWORD_HELP_TEXT}</p>
                  }
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Repetir contraseña *</label>
                  <div className="relative">
                    <input type={showPass2 ? "text" : "password"} {...form3.register("password2")} placeholder="Repite la contraseña" className={inputClass(!!form3.formState.errors.password2) + " pr-11"} />
                    <button type="button" onClick={() => setShowPass2(!showPass2)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form3.formState.errors.password2 && <p className="text-red-500 text-xs mt-1">{form3.formState.errors.password2.message}</p>}
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => setPaso(2)} className="flex items-center gap-2 px-4 py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-background transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* ---- PASO 4 — DOCUMENTOS ---- */}
            {paso === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground text-sm mb-3">Fotografías del documento</h3>
                <p className="text-xs text-muted-foreground -mt-2 mb-4">
                  Sube fotos claras y legibles de tu documento de identidad.
                </p>

                <div className="grid grid-cols-1 gap-4">
                  <FileInput label="Anverso (frente)" file={anverso} onChange={setAnverso} />
                  <FileInput label="Reverso (dorso)"  file={reverso} onChange={setReverso} />
                  <FileInput label="Foto sosteniendo el documento" file={fotoSosteniendo} onChange={setFotoSosteniendo} />
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => setPaso(3)} className="flex items-center gap-2 px-4 py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-background transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <button
                    onClick={submitFinal}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-slate-300 disabled:cursor-not-allowed text-primary-foreground rounded-xl text-sm font-medium transition-colors"
                  >
                    {loading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle className="w-4 h-4" />
                    }
                    {loading ? "Registrando..." : "Crear cuenta"}
                  </button>
                </div>
              </div>
            )}

            <p className="text-center text-muted-foreground text-xs mt-6">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-foreground font-medium hover:text-primary transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}