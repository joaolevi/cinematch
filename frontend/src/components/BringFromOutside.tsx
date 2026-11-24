import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { ExternalTitle } from "../types";

const KIND_LABEL: Record<string, string> = { movie: "Filme", series: "Série", album: "Álbum" };

/** Trazer de fora um título que o catálogo ainda não tem (RFF13): busca no TMDB ou no MusicBrainz e importa. */
export default function BringFromOutside({ q }: { q: string }) {
  const navigate = useNavigate();
  const [source, setSource] = useState<"video" | "album" | null>(null);
  const [results, setResults] = useState<ExternalTitle[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // o que está sendo buscado ou importado
  const [error, setError] = useState<string | null>(null);

  // Outra palavra na busca: os resultados de fora deixam de valer
  useEffect(() => {
    setSource(null);
    setResults(null);
    setError(null);
  }, [q]);

  async function search(kind: "video" | "album") {
    setSource(kind);
    setResults(null);
    setError(null);
    setBusy("search");
    try {
      setResults(await api.externalSearch(q.trim(), kind));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function bring(title: ExternalTitle) {
    setError(null);
    setBusy(title.external_id);
    try {
      const media = await api.externalImport(title.external_id);
      navigate(`/media/${media.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <section className="card mt-10 p-5">
      <h2 className="font-display text-lg font-bold">Não achou o que procurava?</h2>
      <p className="mt-1 text-sm text-muted">
        Busque "{q.trim()}" fora do catálogo e traga para o Tastory. Cada pessoa traz até 10 títulos por dia.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-ghost px-3 py-1.5 text-sm" disabled={busy !== null} onClick={() => search("video")}>
          Buscar filmes e séries no TMDB
        </button>
        <button className="btn-ghost px-3 py-1.5 text-sm" disabled={busy !== null} onClick={() => search("album")}>
          Buscar álbuns no MusicBrainz
        </button>
      </div>
      {busy === "search" && <p className="mt-3 text-sm text-muted">Procurando...</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {results && results.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          Nada com esse nome no {source === "album" ? "MusicBrainz" : "TMDB"}. Tente escrever de outro jeito.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="mt-4 divide-y divide-line/60">
          {results.slice(0, 10).map((t) => (
            <li key={t.external_id} className="flex items-center gap-3 py-2">
              {t.poster_url ? (
                <img src={t.poster_url} alt="" className="h-14 w-10 shrink-0 rounded-[2px] object-cover" loading="lazy" />
              ) : (
                <span aria-hidden className="h-14 w-10 shrink-0 rounded-[2px] bg-bg" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" title={t.title}>
                  {t.title}
                </p>
                <p className="text-xs text-muted">
                  {[KIND_LABEL[t.type] ?? t.type, t.year].filter(Boolean).join(" · ")}
                </p>
              </div>
              {t.media_id ? (
                <Link to={`/media/${t.media_id}`} className="btn-ghost px-3 py-1 text-xs">
                  Abrir no Tastory
                </Link>
              ) : (
                <button className="btn-primary px-3 py-1 text-xs" disabled={busy !== null} onClick={() => bring(t)}>
                  {busy === t.external_id ? "Trazendo..." : "Trazer para o Tastory"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Dados de filmes e séries: TMDB. Dados de álbuns: MusicBrainz. Um álbum leva alguns segundos para chegar.
      </p>
    </section>
  );
}
