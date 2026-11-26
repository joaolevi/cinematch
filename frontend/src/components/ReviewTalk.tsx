import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { plural } from "../format";
import type { Comment } from "../types";

/** O que a conversa precisa saber da resenha: na Comunidade e na página do título (RFF30). */
export interface TalkEntry {
  id: number;
  user_id?: number | null;
  user_name: string;
  likes: number;
  liked: boolean;
  comments: number;
}

/** Os comentários de uma resenha, com o campo para comentar (RFF30). */
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
    <div className="mt-3 border-l-2 border-line/60 pl-4">
      {comments === null && !error && <p className="text-sm text-muted">Abrindo os comentários...</p>}
      {comments?.map((c) => (
        <div key={c.id} className="py-1.5 text-sm">
          <Link to={`/pessoas/${c.user_id}`} className="font-semibold hover:text-accent">
            {c.user_name}
          </Link>{" "}
          <span className="break-words whitespace-pre-line text-stone-200">{c.text}</span>
          {c.can_delete && (
            <button className="ml-2 text-xs text-muted underline hover:text-accent" onClick={() => remove(c)}>
              Apagar
            </button>
          )}
        </div>
      ))}
      <form onSubmit={publish} className="mt-2 flex flex-wrap items-start gap-2">
        <label className="sr-only" htmlFor={`comentario-${entry.id}`}>
          Comentário sobre a resenha de {entry.user_name}
        </label>
        <textarea
          id={`comentario-${entry.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={1}
          placeholder="Escreva um comentário"
          className="input min-h-9 min-w-0 flex-1 resize-y py-1.5 text-sm"
        />
        <button className="btn-primary px-3 py-1.5 text-sm" disabled={busy || !text.trim()}>
          {busy ? "Publicando..." : "Publicar comentário"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

/** Curtir e comentar a resenha (RFF30). A própria resenha mostra as curtidas, sem o botão. */
export default function ReviewTalk({ entry }: { entry: TalkEntry }) {
  const { user } = useAuth();
  const mine = user?.id === entry.user_id;
  const [likes, setLikes] = useState(entry.likes);
  const [liked, setLiked] = useState(entry.liked);
  const [comments, setComments] = useState(entry.comments);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {!mine && (
          <button
            onClick={toggleLike}
            disabled={busy}
            aria-pressed={liked}
            className={`cursor-pointer hover:text-accent ${liked ? "text-accent" : ""}`}
          >
            <span aria-hidden>{liked ? "♥" : "♡"}</span> {liked ? "Tirar curtida" : "Curtir"}
          </button>
        )}
        {likes > 0 && <span>{plural(likes, "curtida", "curtidas")}</span>}
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="cursor-pointer hover:text-accent">
          {open ? "Esconder comentários" : comments > 0 ? `Ver ${plural(comments, "comentário", "comentários")}` : "Comentar"}
        </button>
      </div>
      {open && <Comments entry={entry} onCount={setComments} />}
    </div>
  );
}
