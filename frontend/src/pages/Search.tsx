import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Media, MediaType } from "../api/types";
import MediaCard from "../components/MediaCard";

const PAGE = 24;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const type = (params.get("type") ?? "") as MediaType | "";
  const genre = params.get("genre") ?? "";
  const sort = (params.get("sort") ?? "popularity") as "popularity" | "title" | "year";

  const [text, setText] = useState(q);
  const [genres, setGenres] = useState<string[]>([]);
  const [items, setItems] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.genres().then(setGenres).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .media({ q, type, genre, sort, limit: PAGE, offset: 0 })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, type, genre, sort]);

  function setParam(k: string, v: string) {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n);
  }

  async function more() {
    try {
      const r = await api.media({ q, type, genre, sort, limit: PAGE, offset: items.length });
      setItems((prev) => [...prev, ...r.items]);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <>
      <h1>Buscar</h1>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", text.trim());
        }}
      >
        <input
          className="input grow"
          placeholder="Título, diretor, tag…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select className="input" value={type} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">Todos</option>
          <option value="movie">Filmes</option>
          <option value="series">Séries</option>
        </select>
        <select className="input" value={genre} onChange={(e) => setParam("genre", e.target.value)}>
          <option value="">Todos os gêneros</option>
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => setParam("sort", e.target.value)}>
          <option value="popularity">Popularidade</option>
          <option value="title">Título</option>
          <option value="year">Ano</option>
        </select>
        <button className="btn">Buscar</button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          <p className="muted small">{total} resultado(s)</p>
          <div className="grid">
            {items.map((m) => (
              <MediaCard key={m.id} media={m} />
            ))}
          </div>
          {items.length < total && (
            <button className="btn ghost" onClick={more}>
              Carregar mais
            </button>
          )}
        </>
      )}
    </>
  );
}
