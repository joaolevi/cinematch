import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { localDate } from "../format";
import { useDiaryVersion } from "../seen";
import type { Invite } from "../types";
import Poster from "./Poster";
import { Avatar } from "./WatchedBy";

/** "sábado, 28 de nov.", "hoje", "amanhã" ou "ontem". */
function dayLabel(day: string): string {
  if (day === localDate()) return "hoje";
  if (day === localDate(-1)) return "amanhã";
  if (day === localDate(1)) return "ontem";
  return new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
}

/** Um ingresso: o pôster, as duas fotos juntas, o dia e o que fazer agora. */
function Ticket({ inv, i, onAnswer }: { inv: Invite; i: number; onAnswer: (id: number, answer: "accepted" | "declined") => void }) {
  const other = inv.mine ? inv.receiver : inv.sender;
  const verb = inv.media.type === "album" ? "ouvir" : "ver";
  const past = inv.day != null && inv.day < localDate();
  let line: React.ReactNode;
  let action: React.ReactNode = null;
  if (inv.status === "pending" && !inv.mine) {
    line = <>{other.name.split(" ")[0]} chamou você para {verb} junto</>;
    action = (
      <div className="mt-auto flex gap-2">
        <button className="btn-primary px-3 py-1 text-xs" onClick={() => onAnswer(inv.id, "accepted")}>
          Bora!
        </button>
        <button className="btn-ghost px-3 py-1 text-xs" onClick={() => onAnswer(inv.id, "declined")}>
          Agora não
        </button>
      </div>
    );
  } else if (inv.status === "pending") {
    line = <>Esperando a resposta de {other.name.split(" ")[0]}</>;
  } else if (past && !inv.registered) {
    line = <>Vocês combinaram {verb} junto. Como foi?</>;
    action = (
      <Link to={`/media/${inv.media.id}`} className="btn-primary mt-auto self-start px-3 py-1 text-xs">
        Registrar a lembrança
      </Link>
    );
  } else if (past) {
    line = <>Lembrança guardada com {other.name.split(" ")[0]} ✓</>;
  } else {
    line = <>Combinado com {other.name.split(" ")[0]}!</>;
  }
  return (
    <li
      className="rise relative flex w-80 shrink-0 snap-start gap-4 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface to-[#2a1d16] p-4"
      style={{ "--i": i } as CSSProperties}
    >
      {/* O picote do ingresso */}
      <span aria-hidden className="absolute top-1/2 -left-2.5 h-5 w-5 -translate-y-1/2 rounded-full bg-bg" />
      <span aria-hidden className="absolute top-1/2 -right-2.5 h-5 w-5 -translate-y-1/2 rounded-full bg-bg" />
      <Link to={`/media/${inv.media.id}`} className="w-20 shrink-0 self-start" aria-label={inv.media.title}>
        <Poster media={inv.media} compact rounded="rounded-md" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex -space-x-2">
          <Avatar name={inv.sender.name} userId={inv.sender.id} size="h-7 w-7 text-xs ring-2 ring-surface" />
          <Avatar name={inv.receiver.name} userId={inv.receiver.id} size="h-7 w-7 text-xs ring-2 ring-surface" />
        </div>
        <Link to={`/media/${inv.media.id}`} className="mt-1.5 line-clamp-2 font-display leading-tight font-bold hover:text-accent">
          {inv.media.title}
        </Link>
        <p className="mt-0.5 text-xs text-stone-300">{line}</p>
        {inv.day && <p className="mt-1 font-hand text-lg leading-5 font-bold text-accent">📅 {dayLabel(inv.day)}</p>}
        {inv.note && <p className="mt-1 line-clamp-2 text-xs text-muted italic">“{inv.note}”</p>}
        {action && <div className="mt-3 flex flex-1 flex-col">{action}</div>}
      </div>
    </li>
  );
}

/**
 * Lembranças juntos: os convites para ver ou ouvir com alguém, como ingressos. Os que pedem resposta vêm primeiro,
 * depois os que já passaram e esperam o "Como foi?", e por fim os combinados e os que esperam resposta.
 */
export default function Memories() {
  const [items, setItems] = useState<Invite[]>([]);
  const version = useDiaryVersion();
  useEffect(() => {
    api.invites().then((r) => setItems(r.items)).catch(() => {});
  }, [version]);
  if (items.length === 0) return null;

  const today = localDate();
  const rank = (i: Invite) =>
    i.status === "pending" && !i.mine ? 0 : i.status === "accepted" && i.day && i.day < today && !i.registered ? 1 : i.status === "accepted" ? 2 : 3;
  const sorted = [...items].sort((a, b) => rank(a) - rank(b));

  async function answer(id: number, ans: "accepted" | "declined") {
    const updated = await api.answerInvite(id, ans);
    setItems(ans === "declined" ? items.filter((i) => i.id !== id) : items.map((i) => (i.id === id ? updated : i)));
  }

  return (
    <section id="lembrancas" aria-labelledby="lembrancas-titulo" className="scroll-mt-24">
      <h2 id="lembrancas-titulo" className="mb-4 font-display text-2xl font-bold">
        Bora juntos?
        <span className="block font-hand text-xl font-bold text-accent sm:ml-3 sm:inline">lembranças pra criar com quem você gosta</span>
      </h2>
      <ul className="flex snap-x gap-5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] -mx-3">
        {sorted.map((inv, i) => (
          <Ticket key={inv.id} inv={inv} i={i} onAnswer={answer} />
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Para criar uma, abra um título e toque em Compartilhar.</p>
    </section>
  );
}
