import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { MediaDetail, MediaList } from "../api/types";
import Poster from "../components/Poster";
import StarRating, { formatRating } from "../components/StarRating";

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

  if (error && !m) return <p className="error">{error}</p>;
  if (!m) return <p className="muted">Carregando…</p>;

  return (
    <div className="detail">
      <Poster title={m.title} url={m.poster_url} />
      <div>
        <h1>
          {m.title} {m.year && <span className="muted">({m.year})</span>}
        </h1>
        <p className="muted">
          {m.type === "movie" ? "Filme" : "Série"} · {m.genres.join(", ")}
        </p>
        {m.creators.length > 0 && <p className="small">Direção/criação: {m.creators.join(", ")}</p>}
        {m.average_rating != null && <p>Média da comunidade: {formatRating(m.average_rating)}</p>}
        {m.my_status ? <p className="small">Seu status: {JSON.stringify(m.my_status).replace(/"/g, "")}</p> : null}
        <p>{m.overview ?? "Sem sinopse."}</p>

        <section className="panel">
          <h3>Já vi</h3>
          <div className="row">
            <StarRating value={rating} onChange={setRating} />
          </div>
          <textarea
            className="input"
            rows={3}
            placeholder="Resenha (opcional)"
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
          <button
            className="btn"
            onClick={() =>
              run(
                () => api.addDiary({ media_id: m.id, rating, review: review.trim() || null }),
                "Registrado no diário.",
              )
            }
          >
            Registrar no diário
          </button>
        </section>

        <section className="panel">
          <h3>Adicionar a uma lista</h3>
          <div className="row">
            <select className="input" value={listId} onChange={(e) => setListId(Number(e.target.value))}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={listId === ""}
              onClick={() => run(() => api.addToList(Number(listId), m.id), "Adicionado à lista.")}
            >
              Adicionar
            </button>
          </div>
        </section>

        {msg && <p className="ok">{msg}</p>}
        {error && <p className="error">{error}</p>}

        {m.reviews && m.reviews.length > 0 && (
          <section>
            <h3>Resenhas</h3>
            {m.reviews.map((r, i) => (
              <blockquote key={r.id ?? i}>
                <strong>{r.user_name ?? "Usuário"}</strong> {r.rating != null && <span>· {formatRating(r.rating)}</span>}
                <p>{r.review}</p>
              </blockquote>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
