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
      <h1 className="text-3xl font-bold">Buscar</h1>
      <form
        className="mt-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", text.trim());
        }}
      >
        <input
          className="input min-w-48 flex-1"
          placeholder="Título, diretor, tag…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select className="input w-auto" value={type} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">Todos</option>
          <option value="movie">Filmes</option>
          <option value="series">Séries</option>
        </select>
        <select className="input w-auto" value={genre} onChange={(e) => setParam("genre", e.target.value)}>
          <option value="">Todos os gêneros</option>
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => setParam("sort", e.target.value)}>
          <option value="popularity">Popularidade</option>
          <option value="title">Título</option>
          <option value="year">Ano</option>
        </select>
        <button className="btn-primary">Buscar</button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="mt-8 text-muted">Carregando…</p>
      ) : (
        <>
          <p className="mt-5 text-sm text-muted">{total} resultado(s)</p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((m) => (
              <MediaCard key={m.id} media={m} />
            ))}
          </div>
          {items.length < total && (
            <div className="mt-8 text-center">
              <button className="btn-ghost" onClick={more}>
                Carregar mais
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
