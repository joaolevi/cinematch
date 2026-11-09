import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Highlight, { Buttons, DismissButton } from "../components/Highlight";
import MediaCard from "../components/MediaCard";
import SeenModal from "../components/SeenModal";
import SeenStamp from "../components/SeenStamp";
import Toast from "../components/Toast";
import { OnScreen, useImpressions } from "../impressions";
import { diaryChanged, useSeen } from "../seen";
import type { Feed, FeedbackAction, Media, MediaType } from "../types";
import { MEDIA_GRID } from "../ui";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import ListName from "../components/ListName";

const PAGE = 18;

const STRATEGY_LABEL: Record<Feed["strategy"], string> = {
  hybrid: "Escolhidos a dedo, com base no seu gosto e em quem curte coisas parecidas",
  content: "Escolhidos a dedo, com base no que você curte",
  trending: "O que está em alta agora. Conte o que você curte e isso aqui fica com a sua cara",
};

export default function FeedPage() {
  usePageTitle("Para você");
  const { user } = useAuth();
  const [type, setType] = useState<MediaType | "">("");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenTarget, setSeenTarget] = useState<Media | null>(null);
  const [toast, setToast] = useState<{
    text: ReactNode;
    undo?: () => void;
  } | null>(null);
  const [stamp, setStamp] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fetching = useRef(false);
  const replacing = useRef(false); // enquanto a lista é substituída, a paginação espera
  const impressions = useImpressions();
  const seen = useSeen(user?.id);
  const latestLoad = useRef(0); // respostas de um filtro antigo são ignoradas
  const alreadyShown = useRef(new Set<number>()); // tudo o que apareceu desde o último recomeço

  const load = useCallback(async () => {
    const thisLoad = ++latestLoad.current;
    replacing.current = true;
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
      if (thisLoad === latestLoad.current) {
        replacing.current = false;
        setLoading(false);
      }
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!feed || fetching.current || replacing.current) return;
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
    replacing.current = true;
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
      if (thisLoad === latestLoad.current) {
        replacing.current = false;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const target = bottom.current;
    if (!target || !hasMore || moreFailed || loading || loadingMore) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, moreFailed, loading, loadingMore]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function act(
    media: Media,
    action: FeedbackAction,
    rating?: number | null,
    review?: string,
    date?: string | null,
  ) {
    // A reação só conta se o título tiver sido exibido, mesmo com o card quase saindo da tela
    const rec = feed?.items.find((i) => i.media.id === media.id);
    if (rec) impressions.mark(rec);
    await impressions.send();
    await api.feedback(media.id, action, rating, review, date);
    const position = feed?.items.findIndex((i) => i.media.id === media.id) ?? -1;
    const generation = latestLoad.current;
    setFeed((f) => (f ? { ...f, items: f.items.filter((i) => i.media.id !== media.id) } : f));
    if (action === "seen") {
      setStamp(Date.now());
      diaryChanged();
      setToast({ text: `Boa! "${media.title}" entrou no seu diário` });
    } else if (action === "want") {
      setToast({
        text: (
          <>
            Anotado! "{media.title}" está na sua lista <ListName />
          </>
        ),
      });
    } else {
      setToast({
        text: `Combinado, não vamos mais sugerir "${media.title}"`,
        undo: rec
          ? async () => {
              setToast(null);
              await api.undoDismiss(media.id);
              if (generation !== latestLoad.current) return; // o filtro mudou: o card não pertence mais a esta lista
              setFeed((f) => {
                if (!f || f.items.some((i) => i.media.id === media.id)) return f;
                const items = [...f.items];
                items.splice(Math.max(position, 0), 0, rec);
                return { ...f, items };
              });
            }
          : undefined,
      });
    }
  }

  // O que a pessoa registrou em outra tela (como o Registrar) sai das sugestões
  const [highlight, ...rest] = (feed?.items ?? []).filter((i) => !seen?.has(i.media.id));

  return (
    <div>
      <SeenStamp id={stamp} />
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
      {loading && !feed && <HandNote className="mt-6">Procurando algo a sua cara...</HandNote>}

      {highlight && (
        <OnScreen key={highlight.media.id} rec={highlight} onSeen={impressions.mark}>
          <Highlight
            rec={highlight}
            label={feed?.strategy === "trending" ? "Em alta agora" : "Nossa aposta para você"}
            act={act}
            onSeen={() => setSeenTarget(highlight.media)}
          />
        </OnScreen>
      )}

      <div className={`mt-8 ${MEDIA_GRID}`}>
        {rest.map((rec) => (
          <OnScreen key={rec.media.id} rec={rec} onSeen={impressions.mark}>
            <MediaCard media={rec.media} overlay={<DismissButton onClick={() => act(rec.media, "dismiss")} />}>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted" title={rec.reason}>
                {rec.reason}
              </p>
              <Buttons rec={rec} act={act} onSeen={() => setSeenTarget(rec.media)} />
            </MediaCard>
          </OnScreen>
        ))}
      </div>

      <div ref={bottom} />
      {loadingMore && <HandNote className="mt-8 text-center">Procurando mais títulos para você...</HandNote>}
      {moreFailed && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted">Não conseguimos trazer mais sugestões agora.</p>
          <button className="btn-ghost mt-3" onClick={loadMore}>
            Tentar de novo
          </button>
        </div>
      )}
      {feed && !hasMore && !loading && (
        <p className="mt-8 text-center text-muted">
          Você viu tudo por aqui! Clique em Trocar sugestões para recomeçar.
        </p>
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
        <Toast>
          <span>{toast.text}</span>
          {toast.undo && (
            <button className="cursor-pointer font-extrabold text-[#b9452f] hover:underline" onClick={toast.undo}>
              Desfazer
            </button>
          )}
        </Toast>
      )}
    </div>
  );
}
