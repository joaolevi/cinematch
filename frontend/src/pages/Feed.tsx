import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { FeedbackAction, MediaType, Recommendation, RecommendationsResponse } from "../api/types";
import MediaCard from "../components/MediaCard";
import SeenModal from "../components/SeenModal";

export default function Feed() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [type, setType] = useState<MediaType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seenFor, setSeenFor] = useState<Recommendation | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .recommendations({ type: type || undefined, limit: 24 })
      .then((r) => {
        setData(r);
        setItems(r.items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(load, [load]);

  async function act(id: number, action: FeedbackAction, rating?: number | null, review?: string) {
    try {
      await api.feedback(id, {
        action,
        rating: action === "seen" ? (rating ?? null) : undefined,
        review: action === "seen" && review ? review : undefined,
      });
      setItems((prev) => prev.filter((r) => r.media.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      throw e;
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Para você</h1>
        <select
          className="input w-auto"
          value={type}
          onChange={(e) => setType(e.target.value as MediaType | "")}
        >
          <option value="">Filmes e séries</option>
          <option value="movie">Filmes</option>
          <option value="series">Séries</option>
        </select>
      </div>

      {data?.strategy === "trending" && (
        <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
          Ainda estamos conhecendo seu gosto, então estes são os títulos em alta. Registre o que você já viu para
          melhorar as sugestões.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-8 text-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-muted">Sem mais sugestões por agora.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((r) => (
            <MediaCard key={r.media.id} media={r.media} note={r.reason}>
              <button className="btn-want px-3 py-1.5" onClick={() => act(r.media.id, "want").catch(() => {})}>
                Quero ver
              </button>
              <button className="btn-primary px-3 py-1.5" onClick={() => setSeenFor(r)}>
                Já vi
              </button>
              <button
                className="btn-ghost px-3 py-1.5"
                onClick={() => act(r.media.id, "dismiss").catch(() => {})}
              >
                Descartar
              </button>
            </MediaCard>
          ))}
        </div>
      )}

      {seenFor && (
        <SeenModal
          media={seenFor.media}
          onClose={() => setSeenFor(null)}
          onConfirm={async (rating, review) => {
            await act(seenFor.media.id, "seen", rating, review);
            setSeenFor(null);
          }}
        />
      )}
    </>
  );
}
