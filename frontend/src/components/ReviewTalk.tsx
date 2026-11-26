import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { plural, timeAgo } from "../format";
import { Avatar } from "./WatchedBy";
import type { Comment, ReportReason } from "../types";

/** O que a conversa precisa saber da resenha: na Comunidade e na página do título (RFF30). */
export interface TalkEntry {
  id: number;
  user_id?: number | null;
  user_name: string;
  likes: number;
  liked: boolean;
  comments: number;
  /** Se quem vê já denunciou a resenha */
  reported?: boolean;
}

const REASONS: [ReportReason, string][] = [
  ["spoiler", "Conta o que acontece sem aviso de spoiler"],
  ["ofensa", "Ofensiva ou desrespeitosa"],
  ["spam", "Propaganda ou spam"],
  ["outro", "Outro motivo"],
];

/** Denunciar a resenha para a moderação: o motivo e, se quiser, um detalhe. */
function Report({ entry, onDone, onCancel }: { entry: TalkEntry; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState<ReportReason>("spoiler");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 rounded-xl border border-line bg-surface/60 p-4 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api.report(entry.id, reason, note.trim() || undefined);
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="font-semibold">O que tem de errado com a resenha de {entry.user_name}?</legend>
        <div className="mt-2 space-y-1.5">
          {REASONS.map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name={`motivo-${entry.id}`} value={key} checked={reason === key} onChange={() => setReason(key)} className="accent-[var(--color-accent)]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`detalhe-${entry.id}`} className="mt-3 block text-muted">
        Quer contar mais? <span className="text-xs">(opcional, só a moderação vê)</span>
      </label>
      <input id={`detalhe-${entry.id}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="input mt-1 w-full py-1.5 text-sm" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary px-4 py-1.5 text-sm" disabled={busy}>
          {busy ? "Enviando..." : "Enviar denúncia"}
        </button>
        <button type="button" className="btn-ghost px-4 py-1.5 text-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {error && <p className="mt-2 text-red-300">{error}</p>}
    </form>
  );
}

const icon = { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** O coração: cheio quando a pessoa curtiu. */
function Heart({ on }: { on: boolean }) {
  return (
    <svg {...icon} className="h-[18px] w-[18px]">
      <path d="M10 16.5S3 12.3 3 7.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.6c0 4.7-7 8.9-7 8.9z" fill={on ? "currentColor" : "none"} />
    </svg>
  );
}

/** A bandeirinha de denunciar: cheia depois de denunciar. */
function Flag({ on }: { on: boolean }) {
  return (
    <svg {...icon} className="h-4 w-4">
      <path d="M5 17.5V3.5M5 4h9l-2 3.2 2 3.3H5" fill={on ? "currentColor" : "none"} fillOpacity={0.35} />
    </svg>
  );
}

/** O balão dos comentários: cheio quando estão abertos. */
function Bubble({ on }: { on: boolean }) {
  return (
    <svg {...icon} className="h-[18px] w-[18px]">
      <path d="M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3.5 3v-3a2 2 0 0 1-2-2z" fill={on ? "currentColor" : "none"} fillOpacity={0.25} />
    </svg>
  );
}

/** Os comentários de uma resenha, com a foto de quem comentou e o campo para comentar (RFF30). */
function Comments({ entry, onCount }: { entry: TalkEntry; onCount: (n: number) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.comments(entry.id).then(setComments).catch((e) => setError((e as Error).message));
  }, [entry.id]);

  function update(next: Comment[]) {
    setComments(next);
    onCount(next.length);
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !comments) return;
    setBusy(true);
    setError(null);
    try {
      update([...comments, await api.addComment(entry.id, text.trim())]);
      setText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Comment) {
    if (!comments) return;
    try {
      await api.deleteComment(c.id);
      update(comments.filter((x) => x.id !== c.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-surface/60 p-3 sm:p-4">
      {comments === null && !error && <p className="text-sm text-muted">Abrindo os comentários...</p>}
      {comments?.map((c) => (
        <div key={c.id} className="group/comment flex gap-3 text-sm">
          <Link to={`/pessoas/${c.user_id}`} aria-label={`Perfil de ${c.user_name}`} className="shrink-0">
            <Avatar name={c.user_name} userId={c.user_id} size="h-8 w-8 text-xs" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <Link to={`/pessoas/${c.user_id}`} className="font-bold text-accent hover:underline">
                {c.user_name}
              </Link>
              <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
              {c.can_delete && (
                <button
                  className="ml-auto cursor-pointer text-xs text-muted hover:text-coral"
                  aria-label={`Apagar o comentário de ${c.user_name}`}
                  title="Apagar"
                  onClick={() => remove(c)}
                >
                  <svg {...icon} className="h-4 w-4">
                    <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.8 10h6.4L14 6" />
                  </svg>
                </button>
              )}
            </p>
            <p className="mt-0.5 break-words whitespace-pre-line text-stone-200">{c.text}</p>
          </div>
        </div>
      ))}
      <form onSubmit={publish} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`comentario-${entry.id}`}>
          Comentário sobre a resenha de {entry.user_name}
        </label>
        <input
          id={`comentario-${entry.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Escreva um comentário"
          autoComplete="off"
          className="input min-w-0 flex-1 rounded-full px-4 py-2 text-sm"
        />
        {/* Publicar é o aviãozinho, como nas redes sociais; o nome do botão fica para o leitor de tela */}
        <button
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
          disabled={busy || !text.trim()}
          aria-label={busy ? "Publicando o comentário" : "Publicar comentário"}
          title="Publicar comentário"
        >
          <svg {...icon} className="h-[18px] w-[18px]">
            <path d="M3.5 10l13-6-4.5 13-2.5-5.5z" fill="currentColor" fillOpacity={0.2} />
            <path d="M9.5 11.5L16.5 4" />
          </svg>
        </button>
      </form>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

/**
 * Curtir e comentar a resenha (RFF30), como nas redes sociais: o coração curte e descurte, o balão abre e fecha os
 * comentários, e o número fica do lado. A própria resenha mostra o coração sem botão.
 */
export default function ReviewTalk({ entry }: { entry: TalkEntry }) {
  const { user } = useAuth();
  const mine = user?.id === entry.user_id;
  const [likes, setLikes] = useState(entry.likes);
  const [liked, setLiked] = useState(entry.liked);
  const [comments, setComments] = useState(entry.comments);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(!!entry.reported);

  async function toggleLike() {
    setBusy(true);
    const now = !liked;
    try {
      await (now ? api.like(entry.id) : api.unlike(entry.id));
      setLiked(now);
      setLikes((n) => n + (now ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  const action = "flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 -ml-2 transition";
  return (
    <div className="mt-2">
      <div className="flex items-center gap-4 text-sm text-muted">
        {mine ? (
          <span className="flex items-center gap-1.5" title="Curtidas da sua resenha">
            <Heart on={false} />
            <span>{likes}</span>
            <span className="sr-only">{likes === 1 ? "curtida" : "curtidas"}</span>
          </span>
        ) : (
          <button
            onClick={toggleLike}
            disabled={busy}
            aria-pressed={liked}
            aria-label={`${liked ? "Tirar a curtida da" : "Curtir a"} resenha de ${entry.user_name}. ${plural(likes, "curtida", "curtidas")}`}
            title={liked ? "Tirar a curtida" : "Curtir"}
            className={`${action} ${liked ? "text-accent" : "hover:text-accent"}`}
          >
            <Heart on={liked} />
            {likes > 0 && <span aria-hidden>{likes}</span>}
          </button>
        )}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Esconder os comentários" : comments > 0 ? `Ver ${plural(comments, "comentário", "comentários")}` : "Comentar"}
          title={open ? "Esconder os comentários" : "Comentários"}
          className={`${action} ${open ? "text-accent" : "hover:text-accent"}`}
        >
          <Bubble on={open} />
          {comments > 0 && <span aria-hidden>{comments}</span>}
        </button>
        {/* Denunciar fica no canto, discreto: a bandeirinha. Depois de denunciar, ela fica cheia */}
        {!mine &&
          (reported ? (
            <span className="ml-auto flex items-center gap-1.5 text-xs" title="Você denunciou esta resenha">
              <Flag on /> Denunciada
            </span>
          ) : (
            <button
              onClick={() => setReporting(!reporting)}
              aria-expanded={reporting}
              aria-label={`Denunciar a resenha de ${entry.user_name}`}
              title="Denunciar ou avisar que tem spoiler"
              className={`${action} ml-auto ${reporting ? "text-accent" : "hover:text-accent"}`}
            >
              <Flag on={false} />
            </button>
          ))}
      </div>
      {reporting && (
        <Report
          entry={entry}
          onCancel={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            setReported(true);
          }}
        />
      )}
      {open && <Comments entry={entry} onCount={setComments} />}
    </div>
  );
}
