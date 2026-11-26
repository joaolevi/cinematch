import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { timeAgo } from "../format";
import { diaryChanged, useDiaryVersion } from "../seen";
import type { Invite, ReceivedSuggestion } from "../types";
import { dayLabel } from "./Memories";
import { Avatar } from "./WatchedBy";

/**
 * No topo da página do título: quem deixou um bilhetinho sobre ele e quem chamou para ver ou ouvir junto. É o que a
 * pessoa vê quando chega pela notificação, pelo Início ou pela busca, com o que dá para fazer ali mesmo.
 */
export default function FromFriends({
  mediaId,
  album,
  inWatchlist,
  seen,
  onRegister,
}: {
  mediaId: number;
  album: boolean;
  inWatchlist: boolean;
  seen: boolean;
  onRegister: () => void;
}) {
  const [notes, setNotes] = useState<ReceivedSuggestion[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const version = useDiaryVersion();

  useEffect(() => {
    let alive = true;
    Promise.all([api.receivedSuggestions().catch(() => []), api.invites().catch(() => ({ items: [] as Invite[] }))]).then(
      ([s, i]) => {
        if (!alive) return;
        setNotes(s.filter((x) => x.media.id === mediaId));
        // Convite recusado não aparece: não há mais o que fazer com ele
        setInvites(i.items.filter((x) => x.media.id === mediaId && x.status !== "declined"));
      },
    );
    return () => {
      alive = false;
    };
  }, [mediaId, version]);

  if (notes.length === 0 && invites.length === 0) return null;
  const verb = album ? "ouvir" : "ver";
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  async function answer(id: number, ans: "accepted" | "declined") {
    setBusy(true);
    try {
      const updated = await api.answerInvite(id, ans);
      setInvites((list) => (ans === "declined" ? list.filter((x) => x.id !== id) : list.map((x) => (x.id === id ? updated : x))));
    } finally {
      setBusy(false);
    }
  }

  async function want() {
    setBusy(true);
    try {
      await api.feedback(mediaId, "want");
      diaryChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Bilhetinhos e convites sobre este título"
      className="rise mb-5 rounded-2xl border border-accent/40 bg-gradient-to-r from-[#2a1d16] via-surface to-surface p-4 sm:p-5"
    >
      <ul className="space-y-4">
        {invites.map((inv) => {
          const other = inv.mine ? inv.receiver : inv.sender;
          const first = other.name.split(" ")[0];
          const past = inv.day != null && inv.day < today;
          let line: React.ReactNode;
          let actions: React.ReactNode = null;
          if (inv.status === "pending" && !inv.mine) {
            line = (
              <>
                <b className="text-cream">{first}</b> chamou você para {verb} junto
              </>
            );
            actions = (
              <>
                <button className="btn-primary px-4 py-1.5" disabled={busy} onClick={() => answer(inv.id, "accepted")}>
                  Bora!
                </button>
                <button className="btn-ghost px-4 py-1.5" disabled={busy} onClick={() => answer(inv.id, "declined")}>
                  Agora não
                </button>
              </>
            );
          } else if (inv.status === "pending") {
            line = <>Você chamou <b className="text-cream">{first}</b> para {verb} junto. Esperando a resposta.</>;
          } else if (past && !seen) {
            line = <>Vocês combinaram de {verb} junto. Como foi?</>;
            actions = (
              <button className="btn-primary px-4 py-1.5" onClick={onRegister}>
                Registrar a lembrança
              </button>
            );
          } else if (past) {
            line = <>Lembrança guardada com <b className="text-cream">{first}</b> ✓</>;
          } else {
            line = <>Combinado com <b className="text-cream">{first}</b>!</>;
          }
          return (
            <li key={`c${inv.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex shrink-0 -space-x-3" aria-hidden>
                <Avatar name={inv.sender.name} userId={inv.sender.id} size="h-11 w-11 text-sm ring-2 ring-surface" />
                <Avatar name={inv.receiver.name} userId={inv.receiver.id} size="h-11 w-11 text-sm ring-2 ring-surface" />
              </div>
              <div className="min-w-0 flex-[1_1_14rem]">
                <p className="font-hand text-xl leading-6 font-bold text-accent">Bora juntos?</p>
                <p className="text-sm text-stone-200">
                  {line}
                  {inv.day && <span className="ml-1.5 font-semibold text-accent">📅 {dayLabel(inv.day)}</span>}
                </p>
                {inv.note && <p className="mt-0.5 text-sm text-muted italic">“{inv.note}”</p>}
              </div>
              {actions && <div className="flex w-full gap-2 sm:w-auto">{actions}</div>}
            </li>
          );
        })}

        {notes.map((s, i) => (
          <li key={`b${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link to={`/pessoas/${s.sender.id}`} className="shrink-0" aria-label={`Perfil de ${s.sender.name}`}>
              <Avatar name={s.sender.name} userId={s.sender.id} size="h-11 w-11 text-sm" />
            </Link>
            <div className="min-w-0 flex-[1_1_14rem]">
              <p className="font-hand text-xl leading-6 font-bold text-accent">Bilhetinho pra você</p>
              <p className="text-sm text-stone-200">
                <Link to={`/pessoas/${s.sender.id}`} className="font-bold text-cream hover:text-accent">
                  {s.sender.name.split(" ")[0]}
                </Link>{" "}
                deixou um bilhetinho <span className="text-xs text-muted">· {timeAgo(s.created_at)}</span>
              </p>
              {s.note && (
                <p
                  className="postit mt-2 inline-block max-w-xl -rotate-1 px-3 py-1.5 font-hand text-lg leading-6"
                  style={{ "--note": "#f6d27a", "--i": i } as CSSProperties}
                >
                  “{s.note}”
                </p>
              )}
            </div>
            {!seen && i === 0 && (
              <button className={`px-4 py-1.5 max-sm:mr-auto ${inWatchlist ? "btn-ghost" : "btn-want"}`} disabled={busy || inWatchlist} onClick={want}>
                {inWatchlist ? (album ? "Já está no Quero ouvir" : "Já está no Quero ver") : album ? "Quero ouvir" : "Quero ver"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
