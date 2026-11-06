import { useEffect, useState } from "react";
import { api } from "../api";
import MediaCard from "../components/MediaCard";
import { plural } from "../format";
import type { Media, MediaSort, MediaType } from "../types";

const PAGE = 24;

const SORTS: { value: MediaSort; label: string }[] = [
  { value: "popularity", label: "Mais populares" },
  { value: "title", label: "Ordem alfabética" },
  { value: "year", label: "Mais recentes" },
];

/** Buscar Mídias. */
export default function SearchPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<MediaType | "">("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState<MediaSort>("popularity");
  const [genres, setGenres] = useState<string[]>([]);
  const [items, setItems] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.genres().then(setGenres).catch(() => {});
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [q, type, genre, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .search({ q, type, genre, sort, limit: PAGE, offset })
        .then((r) => {
          setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
          setTotal(r.total);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, type, genre, sort, offset]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Buscar</h1>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:flex-1"
          placeholder="Título, diretor, criador ou tag (ex.: Nolan, máfia, brasil)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <select className="input sm:w-40" value={type} onChange={(e) => setType(e.target.value as MediaType | "")}>
          <option value="">Filmes e séries</option>
          <option value="movie">Filmes</option>
          <option value="series">Séries</option>
        </select>
        <select className="input sm:w-48" value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Todos os gêneros</option>
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select className="input sm:w-44" aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as MediaSort)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-3 text-sm text-muted">{total > 0 ? plural(total, "resultado", "resultados") : "Nenhum resultado"}</p>
      {error && <p className="mt-3 text-red-300">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((m) => (
          <MediaCard key={m.id} media={m} />
        ))}
      </div>
      {items.length < total && (
        <div className="mt-8 text-center">
          <button className="btn-ghost" onClick={() => setOffset(items.length)}>
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
