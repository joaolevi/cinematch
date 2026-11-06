import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import MediaCard from "../components/MediaCard";
import SeenModal from "../components/SeenModal";
import type { Feed, FeedbackAction, Media, MediaType } from "../types";

const PAGE = 18;

const STRATEGY_LABEL: Record<Feed["strategy"], string> = {
  hybrid: "Escolhidos a dedo, com base no seu gosto e em quem curte coisas parecidas",
  content: "Escolhidos a dedo, com base no que você curte",
  trending: "O que está em alta agora. Conte o que você curte e isso aqui fica com a sua cara",
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
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fetching = useRef(false);
  const latestLoad = useRef(0); // respostas de um filtro antigo são ignoradas
  const alreadyShown = useRef(new Set<number>()); // tudo o que apareceu desde o último recomeço

  const load = useCallback(async () => {
    const thisLoad = ++latestLoad.current;
    setLoading(true);
    setError(null);
    setHasMore(true);
    setMoreFailed(false);
    try {
      const first = await api.feed(type || undefined, PAGE);
      if (thisLoad === latestLoad.current) {
        alreadyShown.current = new Set(first.items.map((i) => i.media.id));
        setFeed(first);
      }
    } catch (e) {
      if (thisLoad === latestLoad.current) setError((e as Error).message);
    } finally {
      if (thisLoad === latestLoad.current) setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!feed || fetching.current) return;
    const thisLoad = latestLoad.current;
    fetching.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const next = await api.feed(type || undefined, PAGE, [...alreadyShown.current]);
      if (thisLoad !== latestLoad.current) return;
      const fresh = next.items.filter((i) => !alreadyShown.current.has(i.media.id));
      fresh.forEach((i) => alreadyShown.current.add(i.media.id));
      if (fresh.length === 0) setHasMore(false);
      else setFeed((f) => (f ? { ...f, items: [...f.items, ...fresh] } : f));
    } catch {
      if (thisLoad === latestLoad.current) setMoreFailed(true);
    } finally {
      fetching.current = false;
      setLoadingMore(false);
    }
  }, [feed, type]);

  async function swap() {
    const thisLoad = ++latestLoad.current;
    setLoading(true);
    setError(null);
    setMoreFailed(false);
    try {
      const next = await api.feed(type || undefined, PAGE, [...alreadyShown.current]);
      if (thisLoad !== latestLoad.current) return;
      if (next.items.length === 0) {
        await load(); // acabaram os títulos novos: recomeça do início
        return;
      }
      next.items.forEach((i) => alreadyShown.current.add(i.media.id));
      setFeed(next);
      setHasMore(true);
      window.scrollTo(0, 0);
    } catch (e) {
      if (thisLoad === latestLoad.current) setError((e as Error).message);
    } finally {
      if (thisLoad === latestLoad.current) setLoading(false);
    }
  }

  useEffect(() => {
    const target = bottom.current;
    if (!target || !hasMore || moreFailed) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, moreFailed]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function act(media: Media, action: FeedbackAction, rating?: number | null, review?: string, date?: string | null) {
    await api.feedback(media.id, action, rating, review, date);
    setFeed((f) => (f ? { ...f, items: f.items.filter((i) => i.media.id !== media.id) } : f));
    setToast(
      action === "want"
        ? `Anotado! "${media.title}" está na sua lista Quero ver`
        : action === "seen"
          ? `Boa! "${media.title}" entrou no seu diário`
          : `Combinado, não vamos mais sugerir "${media.title}"`,
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Para você, {user?.name.split(" ")[0]}</h1>
          {feed && <p className="mt-1 text-sm text-muted">{STRATEGY_LABEL[feed.strategy]}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["", "movie", "series"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`chip cursor-pointer px-4 py-1.5 text-sm ${type === t ? "border-accent text-accent" : ""}`}
            >
              {t === "" ? "Tudo" : t === "movie" ? "Filmes" : "Séries"}
            </button>
          ))}
          <button className="btn-ghost px-3 py-1.5" disabled={loading} onClick={swap}>
            ↻ Trocar sugestões
          </button>
        </div>
      </div>

      {user && feed?.strategy === "trending" && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Conte o que você curte e a gente acerta muito mais.</p>
          <Link to="/onboarding" className="btn-primary">
            Definir preferências
          </Link>
        </div>
      )}

      {error && <p className="mt-6 text-red-300">{error}</p>}
      {loading && !feed && <p className="mt-6 text-muted">Procurando algo a sua cara...</p>}

      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {feed?.items.map((rec) => (
          <MediaCard key={rec.media.id} media={rec.media}>
            <p className="mt-1 line-clamp-2 text-xs text-accent/90" title={rec.reason}>
              {rec.reason}
            </p>
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1">
              <button className="btn-want px-1 py-1 text-[11px]" onClick={() => act(rec.media, "want")}>
                Quero ver
              </button>
              <button className="btn-seen px-1 py-1 text-[11px]" onClick={() => setSeenTarget(rec.media)}>
                Já vi
              </button>
              <button className="btn-skip px-2 py-1 text-[11px]" title="Não me interesso" aria-label="Não me interesso" onClick={() => act(rec.media, "dismiss")}>
                ✕
              </button>
            </div>
          </MediaCard>
        ))}
      </div>

      <div ref={bottom} />
      {loadingMore && <p className="mt-8 text-center text-sm text-muted">Procurando mais títulos para você...</p>}
      {moreFailed && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted">Não conseguimos trazer mais sugestões agora.</p>
          <button className="btn-ghost mt-3" onClick={loadMore}>
            Tentar de novo
          </button>
        </div>
      )}
      {feed && !hasMore && !loading && (
        <p className="mt-8 text-center text-muted">Você viu tudo por aqui! Clique em Trocar sugestões para recomeçar.</p>
      )}

      {seenTarget && (
        <SeenModal
          media={seenTarget}
          onClose={() => setSeenTarget(null)}
          onConfirm={async (rating, review, date) => {
            await act(seenTarget, "seen", rating, review, date);
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
