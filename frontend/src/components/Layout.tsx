import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-2 py-1.5 text-sm font-medium transition sm:px-3 ${
    isActive ? "bg-surface-2 text-accent" : "text-slate-300 hover:text-white"
  }`;

export function Logo() {
  return (
    <span className="text-2xl font-extrabold tracking-tight">
      Tast<span className="text-accent">ory</span>
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/">
            <Logo />
          </NavLink>
          <nav className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-auto">
            <NavLink to="/" end className={linkClass}>
              Para você
            </NavLink>
            <NavLink to="/buscar" className={linkClass}>
              Buscar
            </NavLink>
            <NavLink to="/diario" className={linkClass}>
              Diário
            </NavLink>
            <NavLink to="/listas" className={linkClass}>
              Listas
            </NavLink>
            <NavLink to="/comunidade" className={linkClass}>
              Comunidade
            </NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" className={linkClass}>
                Admin
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user?.name}</span>
            <button
              className="btn-ghost px-3 py-1.5"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-muted">
        <Link to="/sobre" className="hover:text-accent">
          Sobre o Tastory
        </Link>
      </footer>
    </div>
  );
}
