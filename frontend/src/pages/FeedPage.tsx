import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import MediaCard from "../components/MediaCard";
import SeenModal from "../components/SeenModal";
import type { Feed, FeedbackAction, Media, MediaType } from "../types";

const STRATEGY_LABEL: Record<Feed["strategy"], string> = {
  hybrid: "Híbrido: seu perfil + usuários parecidos com você",
  content: "Baseado no seu perfil de gosto",
  trending: "Em alta — registre ou avalie títulos para personalizar",
};

/** Ver Recomendações: feed com Quero ver / Já vi / Não me interesso. */
export default function FeedPage() {
  const { user } = useAuth();
  const [type, setType] = useState<MediaType | "">("");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenTarget, setSeenTarget] = useState<Media | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFeed(await api.feed(type || undefined, 18));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function act(media: Media, action: FeedbackAction, rating?: number | null, review?: string) {
    await api.feedback(media.id, action, rating, review);
    setFeed((f) => (f ? { ...f, items: f.items.filter((i) => i.media.id !== media.id) } : f));
    setToast(
      action === "want"
        ? `"${media.title}" foi para a sua lista Quero ver`
        : action === "seen"
          ? `"${media.title}" registrado no diário`
          : `Ok, não vamos mais sugerir "${media.title}"`,
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Para você, {user?.name.split(" ")[0]}</h1>
          {feed && <p className="mt-1 text-sm text-muted">{STRATEGY_LABEL[feed.strategy]}</p>}
        </div>
        <div className="flex items-center gap-2">
          {(["", "movie", "series"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`chip cursor-pointer px-4 py-1.5 text-sm ${type === t ? "border-accent text-accent" : ""}`}
            >
              {t === "" ? "Tudo" : t === "movie" ? "Filmes" : "Séries"}
            </button>
          ))}
          <button className="btn-ghost px-3 py-1.5" onClick={load} title="Gerar novamente">
            ↻
          </button>
        </div>
      </div>

      {user && !user.onboarded && feed?.strategy === "trending" && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Conte o que você curte para receber sugestões personalizadas.</p>
          <Link to="/onboarding" className="btn-primary">
            Definir preferências
          </Link>
        </div>
      )}

      {error && <p className="mt-6 text-red-300">{error}</p>}
      {loading && !feed && <p className="mt-6 text-muted">Calculando recomendações...</p>}

      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {feed?.items.map((rec) => (
          <MediaCard key={rec.media.id} media={rec.media}>
            <p className="mt-1 line-clamp-2 text-xs text-accent/90" title={rec.reason}>
              {rec.reason}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <button className="btn-ghost px-1 py-1 text-[11px]" title="Quero ver" onClick={() => act(rec.media, "want")}>
                + Quero
              </button>
              <button className="btn-ghost px-1 py-1 text-[11px]" title="Já vi" onClick={() => setSeenTarget(rec.media)}>
                ✓ Já vi
              </button>
              <button className="btn-ghost px-1 py-1 text-[11px]" title="Não me interesso" onClick={() => act(rec.media, "dismiss")}>
                ✕
              </button>
            </div>
          </MediaCard>
        ))}
      </div>

      {feed && feed.items.length === 0 && !loading && (
        <p className="mt-6 text-muted">Você zerou o feed! Clique em ↻ para gerar novas sugestões.</p>
      )}

      {seenTarget && (
        <SeenModal
          media={seenTarget}
          onClose={() => setSeenTarget(null)}
          onConfirm={async (rating, review) => {
            await act(seenTarget, "seen", rating, review);
            setSeenTarget(null);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-accent/40 bg-surface px-4 py-2 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
