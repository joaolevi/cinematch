import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DiaryEntry, Media } from "../api/types";
import Poster from "../components/Poster";
import StarRating, { StarsDisplay } from "../components/StarRating";

function Entry({ e, onChanged }: { e: DiaryEntry; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState<number | null>(e.rating);
  const [review, setReview] = useState(e.review ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await api.updateDiary(e.id, { rating, review: review.trim() || null });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }
  async function remove() {
    if (!confirm("Remover este registro do diário?")) return;
    try {
      await api.deleteDiary(e.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  const title = e.media?.title ?? `Título #${e.media_id}`;
  const mediaId = e.media?.id ?? e.media_id;
  const posterMedia = (e.media ?? { title, poster_url: null }) as Pick<Media, "title" | "poster_url">;

  return (
    <li className="card flex gap-4 p-4">
      <div className="w-20 shrink-0">
        <Poster media={posterMedia} compact />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">
          {mediaId ? (
            <Link to={`/titulo/${mediaId}`} className="hover:text-accent">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          {e.consumed_at && <span>{e.consumed_at}</span>}
          {!editing && e.rating != null && <StarsDisplay value={e.rating} size={14} />}
        </div>
        {editing ? (
          <div className="mt-3 space-y-3">
            <StarRating value={rating} onChange={setRating} size={28} />
            <textarea className="input min-h-24" value={review} onChange={(x) => setReview(x.target.value)} />
            <div className="flex gap-2">
              <button className="btn-primary px-3 py-1.5" onClick={save}>
                Salvar
              </button>
              <button className="btn-ghost px-3 py-1.5" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            {e.review && <p className="mt-2 text-sm text-slate-300">{e.review}</p>}
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost px-3 py-1.5" onClick={() => setEditing(true)}>
                Editar
              </button>
              <button className="btn-ghost px-3 py-1.5" onClick={remove}>
                Remover
              </button>
            </div>
          </>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    </li>
  );
}

export default function Diary() {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.diary().then(setEntries).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <h1 className="text-3xl font-bold">Meu diário</h1>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {entries === null ? (
        <p className="mt-6 text-muted">Carregando…</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 text-muted">
          Nada por aqui ainda. Encontre títulos em{" "}
          <Link to="/buscar" className="text-accent hover:underline">
            Buscar
          </Link>{" "}
          e registre o que já viu.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((e) => (
            <Entry key={e.id} e={e} onChanged={load} />
          ))}
        </ul>
      )}
    </>
  );
}
