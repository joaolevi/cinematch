import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import type { Media } from "../types";
import { tabColor } from "../ui";
import QuickLog from "./QuickLog";
import SeenStamp from "./SeenStamp";
import Toast from "./Toast";
import UserMenu from "./UserMenu";

/** Aba de fichário presa na borda de baixo do cabeçalho, cada uma com a sua cor. A aberta se emenda com a página. */
function TabLink({
  to,
  position,
  end = false,
  children,
}: {
  to: string;
  position: number;
  end?: boolean;
  children: string;
}) {
  return (
    <NavLink to={to} end={end} className="nb-tab" style={tabColor(position)}>
      {children}
    </NavLink>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-1.5 font-display text-2xl font-bold tracking-tight">
      {/* Marcador de página desenhado à caneta, com o traço tremido, como o "ory" */}
      <svg viewBox="0 0 18 24" aria-hidden className="h-6 w-[1.15rem] -rotate-6">
        <path
          d="M2.6 1.9C6.1 1.3 11.2 1.7 15.3 1.4c.3 6.6-.2 13.4.3 20.5-2.3-1.8-4.4-3.5-6.6-5.2-2.2 1.8-4.3 3.5-6.6 5.4.1-6.9-.5-13.4.2-20.2z"
          fill="#f2b33d"
          stroke="#b97a12"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M5.4 5.2c2.3-.3 4.6-.2 6.9-.4"
          fill="none"
          stroke="#b97a12"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      {/* "Tast" impresso, "ory" escrito à mão: o gosto vira a sua história */}
      <span>
        Tast
        <span className="scrap translate-y-[0.5px] -rotate-3 font-hand text-[2rem]">ory</span>
      </span>
    </span>
  );
}

// Teste de 08/11: a moldura de papel. O cabeçalho e as margens viram uma folha, e a página escura fica dentro dela.
// Para voltar ao cabeçalho escuro, basta trocar para false.
const PAPER_FRAME = true;

export default function Layout() {
  const { user } = useAuth();
  const [logging, setLogging] = useState(false);
  const [saved, setSaved] = useState<{ media: Media; at: number } | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <div className={`flex min-h-screen flex-col ${PAPER_FRAME ? "desk" : ""}`}>
      {/* O cabeçalho é um tom mais claro que a página, para o menu se destacar e as abas parecerem de fichário */}
      <header
        className={`sticky top-0 z-40 ${
          PAPER_FRAME
            ? "desk desk-bar"
            : "border-b border-line bg-surface/95 shadow-[0_6px_20px_rgb(0_0_0/0.35)] backdrop-blur max-sm:border-b-0"
        }`}
      >
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-end gap-x-6 gap-y-2 px-4 pt-3 sm:px-6 lg:px-10">
          <NavLink to="/" className="pb-[3px]">
            <Logo />
          </NavLink>
          {/* Do mais pessoal para o social. Buscar é uma ferramenta e fica junto do Registrar */}
          <nav className="order-last flex min-h-[2.65rem] w-full items-end gap-1 max-sm:overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,black_80%,transparent)] max-sm:shadow-[inset_0_-1px_0_rgb(61_48_43)] max-sm:[scrollbar-width:none] sm:order-none sm:w-auto">
            <TabLink to="/" end position={0}>
              Início
            </TabLink>
            <TabLink to="/para-voce" position={1}>
              Para você
            </TabLink>
            <TabLink to="/diario" position={2}>
              Diário
            </TabLink>
            <TabLink to="/listas" position={3}>
              Listas
            </TabLink>
            <TabLink to="/comunidade" position={4}>
              Comunidade
            </TabLink>
            {user?.role === "admin" && (
              <TabLink to="/admin" position={5}>
                Administração
              </TabLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 self-end pb-[7px] text-sm sm:gap-3 max-sm:self-center max-sm:pb-0">
            <NavLink
              to="/buscar"
              aria-label="Buscar"
              className={({ isActive }) => `btn-ghost gap-1.5 px-3 py-1 ${isActive ? "border-accent text-accent" : ""}`}
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              <span className="hidden md:inline">Buscar</span>
            </NavLink>
            <button
              className="btn-seen px-3 py-1"
              onClick={() => setLogging(true)}
              title="Registrar no diário algo que você viu"
            >
              + Registrar
            </button>
            <UserMenu />
          </div>
        </div>
      </header>
      <div
        className={`flex flex-1 flex-col ${PAPER_FRAME ? "desk-page mx-1.5 mb-1.5 sm:mx-2.5 sm:mb-2.5 lg:mx-3 lg:mb-3" : ""}`}
      >
        <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
        {logging && (
          <QuickLog
            onClose={() => setLogging(false)}
            onSaved={(media) => {
              setLogging(false);
              setSaved({ media, at: Date.now() });
            }}
          />
        )}
        <SeenStamp id={saved?.at ?? 0} />
        {saved && (
          <Toast>
            <span>Boa! "{saved.media.title}" está no seu diário.</span>
            <Link to="/diario" className="font-extrabold text-[#b9452f] hover:underline" onClick={() => setSaved(null)}>
              Ver diário
            </Link>
          </Toast>
        )}
        <footer className="mx-auto w-full max-w-[1680px] px-4 py-6 text-xs text-muted sm:px-6 lg:px-10">
          <Link to="/sobre" className="hover:text-accent">
            Sobre o Tastory
          </Link>
        </footer>
      </div>
    </div>
  );
}
