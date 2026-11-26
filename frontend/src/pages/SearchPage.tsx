import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import MediaCard from "../components/MediaCard";
import { plural } from "../format";
import { seenLabel, useSeen } from "../seen";
import type { Media, MediaSort, MediaType } from "../types";
import { moodLabel, useMoods } from "../moods";
import { MEDIA_GRID } from "../ui";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import { PersonResult, usePeople } from "../components/PeopleSearch";
import BringFromOutside from "../components/BringFromOutside";

const PAGE = 24;

const SORTS: { value: MediaSort; label: string }[] = [
  { value: "popularity", label: "Mais relevantes" },
  { value: "title", label: "Ordem alfabética" },
  { value: "year", label: "Mais recentes" },
];

/** Buscar Mídias. */
export default function SearchPage() {
  usePageTitle("Buscar");
  const { user } = useAuth();
  const seen = useSeen(user?.id);
  const [q, setQ] = useState("");
  const people = usePeople(q);
  const [type, setType] = useState<MediaType | "">("");
  const [params, setParams] = useSearchParams();
  const genre = params.get("genero") ?? "";
  const person = params.get("pessoa") ?? "";
  const mood = params.get("clima") ?? "";
  const moods = useMoods();
  const [sort, setSort] = useState<MediaSort>("popularity");
  const [decade, setDecade] = useState(0); // #17: 0 = qualquer década
  const [decades, setDecades] = useState<number[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [items, setItems] = useState<Media[]>([]);
  const [total, setTotal] = useState<number | null>(null); // null: a primeira busca ainda não voltou
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.genres().then(setGenres).catch(() => {});
  }, []);

  // As décadas que têm títulos do tipo escolhido
  useEffect(() => {
    api
      .facets([], type || undefined)
      .then((f) => setDecades(f.decades))
      .catch(() => {});
  }, [type]);

  useEffect(() => {
    setOffset(0);
  }, [q, type, genre, person, mood, decade, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .search({ q, type, genre, person, mood, decade: decade || undefined, sort, limit: PAGE, offset })
        .then((r) => {
          setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
          setTotal(r.total);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, type, genre, person, mood, decade, sort, offset]);

  function setFilter(name: "genero" | "pessoa" | "clima", value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }

  const heading = person
    ? `Filmes e séries com ${person}`
    : genre
      ? `Filmes e séries de ${genre}`
      : mood
        ? `Clima: ${moodLabel(moods, mood).toLowerCase()}`
        : "Buscar";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{heading}</h1>
        {person && (
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setFilter("pessoa", "")}>
            Limpar filtro
          </button>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3">
        <input
          className="input search-input col-span-2 sm:flex-1"
          aria-label="Buscar por título, direção ou elenco"
          placeholder="Título, direção, elenco ou pessoa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <select className="input select sm:w-44" aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value as MediaType | "")}>
          <option value="">Tudo</option>
          <option value="movie">Filmes</option>
          <option value="series">Séries</option>
          <option value="album">Álbuns</option>
        </select>
        <select className="input select sm:w-52" aria-label="Gênero" value={genre} onChange={(e) => setFilter("genero", e.target.value)}>
          <option value="">Todos os gêneros</option>
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select
          className="input select sm:w-44"
          aria-label="Década"
          value={decade}
          onChange={(e) => setDecade(Number(e.target.value))}
        >
          <option value={0}>Qualquer década</option>
          {(decade && !decades.includes(decade) ? [decade, ...decades] : decades).map((d) => (
            <option key={d} value={d}>
              {d < 2000 ? `Anos ${d % 100}` : `Anos ${d}`}
            </option>
          ))}
        </select>
        {/* O clima vira mais uma lista de opções, como os outros filtros: as 17 etiquetas ocupavam duas linhas inteiras */}
        {moods.length > 0 && (
          <select className="input select sm:w-44" aria-label="Clima" value={mood} onChange={(e) => setFilter("clima", e.target.value)}>
            <option value="">Qualquer clima</option>
            {moods
              .filter((m) => m.count > 0 || m.key === mood)
              .map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
          </select>
        )}
        <select className="input select col-span-2 sm:w-48" aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as MediaSort)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {/* Buscar por clima (RFF23): filmes, séries e álbuns juntos */}
      {/* Quem tem esse nome no Tastory aparece antes dos títulos, como no Letterboxd */}
      {!!people?.length && (
        <section className="mt-6" aria-label="Pessoas com esse nome">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Pessoas</h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {people.slice(0, 4).map((p) => (
              <li key={p.id}>
                <PersonResult person={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {total == null ? (
        !error && <HandNote className="mt-6">Procurando no catálogo...</HandNote>
      ) : total > 0 ? (
        <p className="mt-3 text-sm text-muted">{plural(total, "resultado", "resultados")}</p>
      ) : (
        <HandNote className="mt-6">Nada com esse nome por aqui. Que tal outra palavra?</HandNote>
      )}
      {error && <p className="mt-3 text-red-300">{error}</p>}

      <div className={`mt-6 ${MEDIA_GRID}`}>
        {items.map((m) => (
          <MediaCard key={m.id} media={m} sticker={seenLabel(seen?.get(m.id)) ? <span className="text-sm">{seenLabel(seen?.get(m.id))}</span> : undefined} />
        ))}
      </div>
      {total != null && items.length < total && (
        <div className="mt-8 text-center">
          <button className="btn-ghost" onClick={() => setOffset(items.length)}>
            Ver mais títulos
          </button>
        </div>
      )}
      {/* Adicionar qualquer título sem o admin (RFF13): aparece no fim da busca por texto */}
      {total != null && items.length >= total && q.trim().length >= 2 && <BringFromOutside q={q} />}
    </div>
  );
}
