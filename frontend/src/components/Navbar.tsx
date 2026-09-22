// src/components/Navbar.tsx

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { User as UserAccount } from "../context/AuthContext";
import { CambiarPasswordModal } from "./ui/CambiarPasswordModal";
import type { LucideIcon } from "lucide-react";
import {
  Flame,
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  UserCog,
  History,
  KeyRound,
  AlertTriangle,
} from "lucide-react";

// ------------------------------------------------
// NAVEGACIÓN POR ROL
// "Mi Perfil" solo se mantiene acá para CONS: es el rol menos
// familiarizado con el sistema, conviene que el acceso quede
// visible en dos lugares. Para ESS/ANH/ADMIN vive solo en el
// menú de usuario (ver PERFIL_PATH más abajo).
// ------------------------------------------------

const navItems: Record<string, { label: string; path: string; icon: LucideIcon }[]> = {
  CONS: [
    { label: "Mi Solicitud",  path: "/consumidor/solicitud", icon: FileText },
    { label: "Mi Perfil",     path: "/consumidor/perfil",    icon: User },
  ],
  ESS: [
    { label: "Solicitudes",   path: "/estacion/solicitudes", icon: FileText },
    { label: "Historial",     path: "/estacion/historial",   icon: History },
  ],
  ANH: [
    { label: "Dashboard",     path: "/anh/dashboard",        icon: LayoutDashboard },
    { label: "Solicitudes",   path: "/anh/solicitudes",      icon: FileText },
    { label: "Consumidores",  path: "/anh/consumidores",     icon: Users },
    { label: "Estaciones",    path: "/anh/estaciones",       icon: Building2 },
    { label: "Reportes",      path: "/anh/reportes",         icon: BarChart3 },
  ],
  ADMIN: [
    { label: "Dashboard",     path: "/anh/dashboard",        icon: LayoutDashboard },
    { label: "Solicitudes",   path: "/anh/solicitudes",      icon: FileText },
    { label: "Consumidores",  path: "/anh/consumidores",     icon: Users },
    { label: "Estaciones",    path: "/anh/estaciones",       icon: Building2 },
    { label: "Reportes",      path: "/anh/reportes",         icon: BarChart3 },
    { label: "Usuarios",      path: "/admin/usuarios",       icon: UserCog },
  ],
};

const rolLabels: Record<string, string> = {
  CONS:  "Consumidor",
  ESS:   "Operador ESS",
  ANH:   "Operador ANH",
  ADMIN: "Administrador",
};

// Ruta de "Mi Perfil" en el menú de usuario, por rol.
const PERFIL_PATH: Record<string, string> = {
  CONS:  "/consumidor/perfil",
  ESS:   "/estacion/perfil",
  ANH:   "/anh/perfil",
  ADMIN: "/anh/perfil",
};

// ------------------------------------------------
// MENÚ DE USUARIO
// Contenido compartido entre el dropdown de escritorio (panel
// claro flotante) y el panel del menú móvil (sobre el navbar
// oscuro) — solo cambian los tokens de color según `variant`.
// Definido fuera de Navbar(): un componente declarado dentro del
// cuerpo de otro se recrea en cada render del padre y React
// desmonta/remonta su subárbol, perdiendo cualquier estado propio
// (acá, el trigger del modal de contraseña lo necesita).
// ------------------------------------------------

const menuVariants = {
  light: {
    nombre:  "text-foreground font-semibold text-sm truncate",
    email:   "text-muted-foreground text-xs truncate",
    item:    "text-muted-foreground hover:text-foreground hover:bg-background",
    divider: "border-border",
    estacionChip: "bg-primary/10",
    logout:  "text-red-600 hover:bg-red-50",
  },
  dark: {
    nombre:  "text-navbar-foreground text-sm font-medium",
    email:   "text-navbar-muted text-xs",
    item:    "text-navbar-muted hover:text-navbar-foreground hover:bg-white/5",
    divider: "border-white/10",
    estacionChip: "bg-primary/20",
    logout:  "text-red-400 hover:bg-white/5",
  },
} as const;

interface UserMenuProps {
  user:              UserAccount;
  variant:           keyof typeof menuVariants;
  onNavigate:        () => void;
  onCambiarPassword: () => void;
  onLogout:          () => void;
}

function UserMenu({ user, variant, onNavigate, onCambiarPassword, onLogout }: UserMenuProps) {
  const v = menuVariants[variant];

  return (
    <>
      <div className={`px-4 py-3 border-b ${v.divider}`}>
        <p className={v.nombre}>{user.nombres} {user.apellido_paterno}</p>
        <p className={v.email}>{user.email}</p>

        {user.tipo_usuario === "ESS" && user.estacion_nombre && (
          <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${v.estacionChip}`}>
            <Building2 className="w-3 h-3 text-primary shrink-0" />
            <p className="text-primary text-xs font-medium truncate">{user.estacion_nombre}</p>
          </div>
        )}

        {!user.email_verificado && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-state-pending-bg text-state-pending-fg rounded-full px-2.5 py-1 text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Correo sin verificar
          </div>
        )}
      </div>

      <Link
        to={PERFIL_PATH[user.tipo_usuario]}
        onClick={onNavigate}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${v.item}`}
      >
        <User className="w-4 h-4" />
        Mi Perfil
      </Link>

      <button
        onClick={() => { onNavigate(); onCambiarPassword(); }}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${v.item}`}
      >
        <KeyRound className="w-4 h-4" />
        Cambiar contraseña
      </button>

      <div className={`border-t ${v.divider} mt-1 pt-1`}>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${v.logout}`}
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------
// NAVBAR COMPONENT
// ------------------------------------------------

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  const [menuOpen,      setMenuOpen]      = useState(false);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);
  const [modalPassword, setModalPassword] = useState(false);

  if (!user) return null;

  const items = navItems[user.tipo_usuario] || [];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) =>
    location.pathname === path ||
    location.pathname.startsWith(path + "/");

  const rolSubtitulo = user.tipo_usuario === "ESS" && user.estacion_nombre
    ? `Operador ESS — ${user.estacion_nombre}`
    : rolLabels[user.tipo_usuario];

  return (
    <nav className="bg-navbar shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ---- LOGO ---- */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-md group-hover:bg-primary-hover transition-colors">
              <Flame className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <p className="text-navbar-foreground font-bold text-sm leading-tight tracking-wide">ANH Bolivia</p>
              <p className="text-navbar-muted text-xs leading-tight">Gestión de Combustible</p>
            </div>
          </Link>

          {/* ---- NAV ITEMS (desktop) ---- */}
          <div className="hidden md:flex items-center gap-1">
            {items.map(({ label, path, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive(path)
                    ? "bg-white/10 text-navbar-foreground"
                    : "text-navbar-muted hover:bg-white/5 hover:text-navbar-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* ---- USER MENU (desktop) ---- */}
          <div className="hidden md:block relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-navbar-muted hover:bg-white/5 hover:text-navbar-foreground transition-all"
            >
              <div className="relative w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-sm">
                  {user.nombres?.charAt(0).toUpperCase()}
                </span>
                {!user.email_verificado && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-state-pending-fg border-2 border-navbar" />
                )}
              </div>
              <div className="text-left">
                <p className="text-navbar-foreground text-sm font-medium leading-tight">
                  {user.nombres}
                </p>
                <p className="text-navbar-muted text-xs leading-tight max-w-48 truncate">
                  {rolSubtitulo}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl shadow-xl border border-border py-1 z-50">
                <UserMenu
                  user={user}
                  variant="light"
                  onNavigate={() => setUserMenuOpen(false)}
                  onCambiarPassword={() => setModalPassword(true)}
                  onLogout={handleLogout}
                />
              </div>
            )}
          </div>

          {/* ---- HAMBURGER (mobile) ---- */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-navbar-muted hover:bg-white/5 hover:text-navbar-foreground transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ---- MOBILE MENU ---- */}
      {menuOpen && (
        <div className="md:hidden bg-navbar border-t border-white/10 px-4 py-3 space-y-1">
          {items.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(path)
                  ? "bg-white/10 text-navbar-foreground"
                  : "text-navbar-muted hover:bg-white/5 hover:text-navbar-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          <div className="border-t border-white/10 pt-2 mt-2">
            <UserMenu
              user={user}
              variant="dark"
              onNavigate={() => setMenuOpen(false)}
              onCambiarPassword={() => setModalPassword(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      <CambiarPasswordModal open={modalPassword} onClose={() => setModalPassword(false)} />
    </nav>
  );
}
