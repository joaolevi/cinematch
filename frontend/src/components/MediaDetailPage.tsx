import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { MediaDetail, MediaList } from "../api/types";
import GenreChip from "../components/GenreChip";
import Poster from "../components/Poster";
import SeenModal from "../components/SeenModal";
import { StarsDisplay, formatRating } from "../components/StarRating";
import { titleHues } from "../lib/visual";

export default function MediaDetailPage() {
  const id = Number(useParams().id);
  const [m, setM] = useState<MediaDetail | null>(null);
  const [lists, setLists] = useState<MediaList[]>([]);
  const [listId, setListId] = useState<number | "">("");
  const [seenOpen, setSeenOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api.mediaDetail(id).then(setM).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    api
      .lists()
      .then((l) => {
        setLists(l);
        if (l.length) setListId(l[0].id); // a primeira é sempre a watchlist "Quero ver"
      })
      .catch(() => {});
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  if (error && !m) return <p className="text-sm text-red-400">{error}</p>;
  if (!m) return <p className="text-muted">Carregando…</p>;

  const [hue, hue2] = titleHues(m.title);
  const status = m.my_status ? JSON.stringify(m.my_status).replace(/"/g, "") : null;

  return (
    <div>
      <section
        className="flex flex-col gap-6 rounded-2xl border border-line/60 p-5 sm:flex-row sm:p-8"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 50% 22%) 0%, hsl(${hue2} 55% 12%) 55%, #0b0d10 100%)`,
        }}
      >
        <div className="w-40 shrink-0 self-center sm:w-52 sm:self-start">
          <Poster media={m} className="shadow-xl shadow-black/50" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">
            {m.title} {m.year && <span className="font-normal text-white/60">({m.year})</span>}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span>{m.type === "movie" ? "Filme" : "Série"}</span>
            {m.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
          </div>
          {m.creators.length > 0 && (
            <p className="mt-3 text-sm text-white/70">Direção/criação: {m.creators.join(", ")}</p>
          )}
          {m.average_rating != null && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <StarsDisplay value={m.average_rating} />
              <span className="font-semibold text-star">{formatRating(m.average_rating)}</span>
              <span className="text-white/60">média da comunidade</span>
            </p>
          )}
          <p className="mt-4 max-w-2xl leading-relaxed text-slate-200">{m.overview ?? "Sem sinopse."}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={() => setSeenOpen(true)}>
              Já vi
            </button>
            <button
              className="btn-want"
              disabled={lists.length === 0}
              onClick={() => run(() => api.addToList(lists[0].id, m.id), "Adicionado a Quero ver.")}
            >
              Quero ver
            </button>
            {status && <span className="chip">Seu status: {status}</span>}
          </div>
        </div>
      </section>

      {(msg || error) && (
        <p className={`mt-4 text-sm ${error ? "text-red-400" : "text-accent"}`}>{error ?? msg}</p>
      )}

      <section className="card mt-6 p-5">
        <h2 className="font-semibold">Adicionar a uma lista</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="input w-auto min-w-48"
            value={listId}
            onChange={(e) => setListId(Number(e.target.value))}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost"
            disabled={listId === ""}
            onClick={() => run(() => api.addToList(Number(listId), m.id), "Adicionado à lista.")}
          >
            Adicionar
          </button>
        </div>
      </section>

      {m.reviews && m.reviews.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Resenhas</h2>
          <div className="mt-4 space-y-3">
            {m.reviews.map((r, i) => (
              <blockquote key={r.id ?? i} className="card p-4">
                <p className="text-sm">
                  <strong>{r.user_name ?? "Usuário"}</strong>{" "}
                  {r.rating != null && <span className="ml-1 text-star">{formatRating(r.rating)}</span>}
                </p>
                <p className="mt-1.5 text-sm text-slate-300">{r.review}</p>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {seenOpen && (
        <SeenModal
          media={m}
          onClose={() => setSeenOpen(false)}
          onConfirm={async (rating, review) => {
            await api.addDiary({ media_id: m.id, rating, review: review || null });
            setSeenOpen(false);
            setMsg("Registrado no diário.");
            load();
          }}
        />
      )}
    </div>
  );
}
