import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { MediaDetail, MediaList } from "../api/types";
import GenreChip from "../components/GenreChip";
import Poster from "../components/Poster";
import StarRating, { StarsDisplay, formatRating } from "../components/StarRating";

export default function MediaDetailPage() {
  const id = Number(useParams().id);
  const [m, setM] = useState<MediaDetail | null>(null);
  const [lists, setLists] = useState<MediaList[]>([]);
  const [listId, setListId] = useState<number | "">("");
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
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

  if (error && !m) return <p className="text-red-400">{error}</p>;
  if (!m) return <p className="text-muted">Carregando…</p>;

  const st = m.my_status;
  const seen = st?.diary_entry_id != null;

  return (
    <div className="grid gap-8 md:grid-cols-[240px_1fr]">
      <div className="mx-auto w-full max-w-[240px] md:mx-0">
        <Poster media={m} />
      </div>

      <div className="min-w-0">
        <h1 className="text-3xl font-bold">
          {m.title} {m.year && <span className="font-normal text-muted">({m.year})</span>}
        </h1>
        <p className="mt-1 text-sm text-muted">{m.type === "movie" ? "Filme" : "Série"}</p>

        {m.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
          </div>
        )}
        {m.creators.length > 0 && (
          <p className="mt-3 text-sm text-slate-300">Direção/criação: {m.creators.join(", ")}</p>
        )}

        {m.avg_rating != null && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <StarsDisplay value={m.avg_rating} />
            <span className="text-slate-300">
              {formatRating(m.avg_rating)}
              {m.ratings_count ? <span className="text-muted"> · {m.ratings_count} nota(s)</span> : null}
            </span>
          </div>
        )}

        {(seen || st?.in_watchlist || st?.dismissed) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {seen && (
              <span className="chip border-accent/40 text-accent">
                Já vi{st?.rating != null ? ` · ${formatRating(st.rating)}` : ""}
              </span>
            )}
            {st?.in_watchlist && <span className="chip border-want/50 text-violet-300">Na watchlist</span>}
            {st?.dismissed && <span className="chip">Descartado das recomendações</span>}
          </div>
        )}

        <p className="mt-5 max-w-prose leading-relaxed text-slate-300">{m.overview || "Sem sinopse."}</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h3 className="font-semibold">Já vi</h3>
            {seen ? (
              <p className="mt-3 text-sm text-muted">
                Você já registrou este título. Para alterar nota ou resenha, vá ao{" "}
                <Link to="/diario" className="text-accent hover:underline">
                  Diário
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="mt-3">
                  <StarRating value={rating} onChange={setRating} size={28} />
                </div>
                <textarea
                  className="input mt-3 min-h-20"
                  placeholder="Resenha (opcional)"
                  value={review}
                  maxLength={2000}
                  onChange={(e) => setReview(e.target.value)}
                />
                <button
                  className="btn-primary mt-3"
                  onClick={() =>
                    run(
                      () => api.addDiary({ media_id: m.id, rating, review: review.trim() || null }),
                      "Registrado no diário.",
                    )
                  }
                >
                  Registrar no diário
                </button>
              </>
            )}
          </section>

          <section className="card p-5">
            <h3 className="font-semibold">Adicionar a uma lista</h3>
            <div className="mt-3 flex gap-2">
              <select className="input" value={listId} onChange={(e) => setListId(Number(e.target.value))}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {st?.list_ids?.includes(l.id) ? " ✓" : ""}
                  </option>
                ))}
              </select>
              <button
                className="btn-want shrink-0"
                disabled={listId === ""}
                onClick={() => run(() => api.addToList(Number(listId), m.id), "Adicionado à lista.")}
              >
                Adicionar
              </button>
            </div>
          </section>
        </div>

        {msg && <p className="mt-4 text-sm text-accent">{msg}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {m.reviews && m.reviews.length > 0 && (
          <section className="mt-10">
            <h3 className="text-xl font-semibold">Resenhas</h3>
            <ul className="mt-4 space-y-3">
              {m.reviews.map((r, i) => (
                <li key={r.id ?? i} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <strong>{r.user_name ?? "Usuário"}</strong>
                    {r.rating != null && <StarsDisplay value={r.rating} size={14} />}
                  </div>
                  {r.review && <p className="mt-2 text-sm text-slate-300">{r.review}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
