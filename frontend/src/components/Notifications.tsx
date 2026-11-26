import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { timeAgo } from "../format";
import type { AppNotification } from "../types";
import { Avatar } from "./WatchedBy";

const EVERY = 60_000; // de quanto em quanto tempo procura avisos novos, com a página aberta

/** A frase de cada aviso, com o link para onde ele leva. */
function describe(n: AppNotification): { text: React.ReactNode; to: string } {
  const who = <strong className="text-cream">{n.actor?.name ?? "Alguém"}</strong>;
  const title = n.media && <strong className="text-cream">{n.media.title}</strong>;
  const media = n.media ? `/media/${n.media.id}` : "/";
  switch (n.kind) {
    case "seguiu":
      return { text: <>{who} começou a seguir você</>, to: n.actor ? `/pessoas/${n.actor.id}` : "/comunidade" };
    case "curtiu":
      return { text: <>{who} curtiu a sua resenha de {title}</>, to: `${media}?aba=resenhas` };
    case "comentou":
      return { text: <>{who} comentou a sua resenha de {title}</>, to: `${media}?aba=resenhas` };
    case "indicou":
      return { text: <>{who} deixou um bilhete: {title}</>, to: media };
    case "convidou":
      return { text: <>{who} quer criar uma lembrança com você: {title}</>, to: "/#lembrancas" };
    case "aceitou":
      return { text: <>{who} topou a lembrança: {title}</>, to: "/#lembrancas" };
    default:
      return {
        text: (
          <>
            {who} {n.media?.type === "album" ? "ouviu" : "viu"} {title}, que está no seu Quero ver
          </>
        ),
        to: media,
      };
  }
}

const ICON: Record<AppNotification["kind"], string> = {
  seguiu: "👋", curtiu: "♥", comentou: "💬", indicou: "📝", registrou: "👀", convidou: "🍿", aceitou: "🎉",
};

/** O sino, com o número de avisos não lidos, e o painel com os avisos. Abrir o painel marca todos como lidos. */
export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const load = () =>
    api
      .notifications()
      .then((r) => {
        setItems(r.items);
        setUnread(r.unread);
      })
      .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, EVERY);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await api.readNotifications().catch(() => {});
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Avisos: ${unread} ${unread === 1 ? "novo" : "novos"}` : "Avisos"}
        className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-[#2b211c]/25 text-[#2b211c] transition hover:border-[#b9452f] hover:text-[#b9452f]"
      >
        <svg viewBox="0 0 20 20" aria-hidden className={`h-[18px] w-[18px] ${unread ? "bell-ring" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8.5a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S5 12.5 5 8.5zM8.3 16.5a1.8 1.8 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span aria-hidden className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#b9452f] px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="rise absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        >
          <p className="border-b border-line/60 px-4 py-3 font-hand text-xl font-bold text-accent">Avisos</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nada por aqui ainda. Quando alguém seguir você, curtir uma resenha ou indicar algo, aparece aqui.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line/60 overflow-y-auto">
              {items.map((n) => {
                const { text, to } = describe(n);
                return (
                  <li key={n.id}>
                    <Link to={to} className={`flex gap-3 px-4 py-3 text-sm transition hover:bg-surface-2 ${n.read ? "" : "bg-accent/5"}`}>
                      <span className="relative h-9 w-9 shrink-0 self-start">
                        {n.actor ? <Avatar name={n.actor.name} userId={n.actor.id} size="h-9 w-9 text-sm" /> : <span className="block h-9 w-9" />}
                        <span aria-hidden className="absolute -right-1.5 -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-surface text-[11px]">
                          {ICON[n.kind]}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 text-stone-300">
                        {text}
                        {n.text && <span className="mt-0.5 line-clamp-2 block text-muted">“{n.text}”</span>}
                        <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                      </span>
                      {n.media?.poster_url && (
                        <img src={n.media.poster_url} alt="" aria-hidden className={`w-8 shrink-0 self-start rounded-sm object-cover ${n.media.type === "album" ? "aspect-square" : "aspect-[2/3]"}`} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
