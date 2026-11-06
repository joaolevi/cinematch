import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-surface-2 text-accent" : "text-slate-300 hover:text-white"
  }`;

export function Logo() {
  return (
    <span className="text-2xl font-extrabold tracking-tight">
      Cine<span className="text-accent">Match</span>
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/">
            <Logo />
          </NavLink>
          <nav className="flex flex-wrap gap-1">
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">
        CineMatch, protótipo para apresentação · Gerência de Projeto 2026.2 (UFAL) · Dados e pôsteres:{" "}
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="text-accent">
          TMDB
        </a>{" "}
        (este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB)
      </footer>
    </div>
  );
}
