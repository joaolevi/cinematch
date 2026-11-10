import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { TAPE_COLORS } from "../ui";
import { Avatar } from "./WatchedBy";

/** Avatar com a inicial e um menu num pedaço de papel: atalhos pessoais e Sair. */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!user) return null;
  const item = "block rounded-md px-3 py-1.5 font-semibold hover:bg-[#2b211c]/[0.07]";
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu de ${user.name}`}
        className="flex cursor-pointer items-center gap-1.5 rounded-full transition hover:ring-2 hover:ring-accent/60"
      >
        <Avatar name={user.name} size="h-8 w-8" />
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={`h-3.5 w-3.5 text-muted transition ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="paper absolute top-full right-0 z-50 mt-3 w-64 rotate-1 rounded-sm py-3 pr-3 pl-12 text-sm"
        >
          <span
            aria-hidden
            className="tape -top-2 left-1/2 -translate-x-1/2 -rotate-3"
            style={{ background: TAPE_COLORS[0] }}
          />
          <p className="px-3 font-hand text-2xl leading-7 font-bold text-[#b9452f]">Oi, {user.name.split(" ")[0]}!</p>
          <p className="truncate px-3 text-xs text-muted">{user.email}</p>
          <div className="mt-2 space-y-0.5" onClick={() => setOpen(false)}>
            <Link role="menuitem" to="/diario" className={item}>
              Meu diário
            </Link>
            <Link role="menuitem" to="/diario?aba=gosto" className={item}>
              Meu gosto
            </Link>
            <Link role="menuitem" to="/listas" className={item}>
              Minhas listas
            </Link>
            <Link role="menuitem" to="/onboarding" className={item}>
              Refazer minhas preferências
            </Link>
            <Link role="menuitem" to="/sobre" className={item}>
              Sobre o Tastory
            </Link>
            <button
              role="menuitem"
              className={`${item} w-full cursor-pointer text-left text-[#b42318]`}
              onClick={() => {
                logout();
                navigate("/bem-vindo");
              }}
            >
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
