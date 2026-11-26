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
      return { text: <>{who} deixou um bilhetinho pra você: {title}</>, to: media };
    case "convidou":
      return { text: <>{who} chamou você pra criar uma lembrança: {title}</>, to: media };
    case "aceitou":
      return { text: <>{who} topou! Vocês vão {n.media?.type === "album" ? "ouvir" : "ver"} {title} juntos</>, to: media };
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

/** "hoje às 14:32", "ontem às 21:00" ou "24 de nov., 18:00", com o "há 2 horas" ao lado. */
function when(iso: string): string {
  const d = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`);
  const hour = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const day = d.toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso de quem vê
  const day0 = (n: number) => {
    const x = new Date();
    x.setDate(x.getDate() - n);
    return x.toLocaleDateString("sv-SE");
  };
  const label = day === day0(0) ? `hoje às ${hour}` : day === day0(1) ? `ontem às ${hour}` : `${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}, ${hour}`;
  return `${timeAgo(iso)} · ${label}`;
}

/** Uma linha do painel: a foto com o ícone, a frase, o recado e quando foi. Não lido: fundo claro e um ponto. */
function Row({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const { text, to } = describe(n);
  return (
    <li>
      <Link
        to={to}
        onClick={() => onOpen(n)}
        className={`flex items-start gap-3 px-4 py-3 text-sm transition hover:bg-surface-2 ${n.read ? "" : "bg-accent/[0.07]"}`}
      >
        <span className="relative h-9 w-9 shrink-0">
          {n.actor ? <Avatar name={n.actor.name} userId={n.actor.id} size="h-9 w-9 text-sm" /> : <span className="block h-9 w-9" />}
          <span aria-hidden className="absolute -right-1.5 -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-surface text-[11px]">
            {ICON[n.kind]}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block ${n.read ? "text-stone-400" : "text-stone-200"}`}>{text}</span>
          {n.text && <span className="mt-0.5 line-clamp-2 block text-stone-400 italic">“{n.text}”</span>}
          <span className={`mt-1 block text-xs ${n.read ? "text-stone-400" : "font-semibold text-accent"}`}>{when(n.created_at)}</span>
        </span>
        {n.media?.poster_url && (
          <img src={n.media.poster_url} alt="" aria-hidden className={`w-8 shrink-0 rounded-sm object-cover ${n.media.type === "album" ? "aspect-square" : "aspect-[2/3]"}`} />
        )}
        <span className="w-2 shrink-0 self-center">
          {!n.read && <span className="block h-2 w-2 rounded-full bg-accent" />}
          <span className="sr-only">{n.read ? "lido" : "não lido"}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * O sino, com o número de avisos não lidos, e o painel "O que rolou". Abrir o painel não marca nada: cada aviso fica
 * lido ao ser aberto, e "Marcar todos como lidos" limpa de uma vez. Os novos vêm separados dos anteriores.
 */
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

  function opened(n: AppNotification) {
    if (n.read) return;
    setItems(items.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    api.readNotification(n.id).catch(() => {});
  }

  async function readAll() {
    setItems(items.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await api.readNotifications().catch(() => {});
  }

  const fresh = items.filter((n) => !n.read);
  const old = items.filter((n) => n.read);
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={unread ? `O que rolou: ${unread} ${unread === 1 ? "aviso novo" : "avisos novos"}` : "O que rolou"}
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
        <div role="dialog" aria-label="O que rolou" className="rise absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-line/60 px-4 py-3">
            <p className="font-hand text-xl font-bold text-accent">O que rolou</p>
            {unread > 0 && (
              <button className="cursor-pointer text-xs font-semibold text-stone-400 underline hover:text-accent" onClick={readAll}>
                Marcar todos como lidos
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-400">Nada por aqui ainda. Quando alguém seguir você, curtir uma resenha ou deixar um bilhetinho, aparece aqui.</p>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto">
              {fresh.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-xs font-bold tracking-wider text-accent uppercase">Novos · {fresh.length}</p>
                  <ul className="divide-y divide-line/60">
                    {fresh.map((n) => (
                      <Row key={n.id} n={n} onOpen={opened} />
                    ))}
                  </ul>
                </>
              )}
              {old.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-xs font-bold tracking-wider text-stone-400 uppercase">Anteriores</p>
                  <ul className="divide-y divide-line/60">
                    {old.map((n) => (
                      <Row key={n.id} n={n} onOpen={opened} />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
