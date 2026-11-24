import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Highlight, { Buttons, DismissButton, OnMyServices } from "../components/Highlight";
import MediaCard from "../components/MediaCard";
import SeenModal from "../components/SeenModal";
import SeenStamp from "../components/SeenStamp";
import Toast from "../components/Toast";
import { OnScreen, useImpressions } from "../impressions";
import { diaryChanged, useSeen } from "../seen";
import TuneMenu, { type Tune } from "../components/TuneMenu";
import { formatMinutes } from "../format";
import { useMoods } from "../moods";
import type { AdjustKind, Discovery, Feed, FeedbackAction, Media, MediaType, Occasion, Recommendation } from "../types";
import { MEDIA_GRID } from "../ui";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import ListName from "../components/ListName";

const PAGE = 18;
const TONIGHT_MINUTES = 150; // "Hoje à noite": cabe numa noite, até 2h30

const STRATEGY_LABEL: Record<Feed["strategy"], string> = {
  hybrid: "Escolhidos a dedo, com base no seu gosto e em quem curte coisas parecidas",
  content: "Escolhidos a dedo, com base no que você curte",
  trending: "O que está em alta agora. Conte o que você curte e isso aqui fica com a sua cara",
  bridge: "Álbuns ligados ao que você curte: trilhas, compositores e quem canta e atua",
  discovery: "Discos de gêneros que você ainda não ouve",
};

export default function FeedPage() {
  usePageTitle("Para você");
  const { user } = useAuth();
  const [type, setType] = useState<MediaType | "">("");
  const [discovery, setDiscovery] = useState<Discovery>("taste");
  // Momento (RFF20): clima e duração máxima; vazio e 0 = qualquer um
  const [mood, setMood] = useState("");
  const [maxMinutes, setMaxMinutes] = useState(0);
  const [occasion, setOccasion] = useState("");
  const [onlyMine, setOnlyMine] = useState(false); // só nos meus serviços (RFF21)
  const moods = useMoods();
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  useEffect(() => {
    api.occasions().then(setOccasions).catch(() => {});
  }, []);
  const moment = useMemo(
    () => ({
      mood: mood || undefined,
      max_minutes: maxMinutes || undefined,
      occasion: occasion || undefined,
      only_mine: onlyMine || undefined,
    }),
    [mood, maxMinutes, occasion, onlyMine],
  );
  const hasServices = (user?.services.length ?? 0) > 0;
  const tonight = maxMinutes === TONIGHT_MINUTES && onlyMine === hasServices;
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenTarget, setSeenTarget] = useState<Media | null>(null);
  const [toast, setToast] = useState<{
    text: ReactNode;
    undo?: () => void;
  } | null>(null);
  const [stamp, setStamp] = useState(0);
  const [stampAlbum, setStampAlbum] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
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
      const first = await api.feed(type || undefined, PAGE, [], discovery, moment);
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
  }, [type, discovery, moment]);

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
      const next = await api.feed(type || undefined, PAGE, [...alreadyShown.current], discovery, moment);
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
  }, [feed, type, discovery, moment]);

  async function swap() {
    const thisLoad = ++latestLoad.current;
    replacing.current = true;
    setLoading(true);
    setError(null);
    setMoreFailed(false);
    try {
      const next = await api.feed(type || undefined, PAGE, [...alreadyShown.current], discovery, moment);
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
      setStampAlbum(media.type === "album");
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

  const firstLower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

  /** Retorno sobre uma sugestão (RFF08): ajusta o gosto ou o momento e traz um novo lote. */
  async function tune(rec: Recommendation, choice: Tune, label: string) {
    const undoAdjust = (kind: AdjustKind, value: string) => async () => {
      setToast(null);
      await api.adjust(kind, value, 1);
      load();
    };
    try {
      if (choice.kind === "because" && rec.because) {
        await api.adjust(rec.because.kind, rec.because.value, 0.5);
        setToast({ text: `Anotado: ${firstLower(label)}. Aqui vai um novo lote.`, undo: undoAdjust(rec.because.kind, rec.because.value) });
        load();
      } else if (choice.kind === "less-genre") {
        await api.adjust("genre", choice.genre, 0.5);
        setToast({ text: `Anotado: ${firstLower(label)}. Aqui vai um novo lote.`, undo: undoAdjust("genre", choice.genre) });
        load();
      } else if (choice.kind === "shorter") {
        setMaxMinutes(choice.minutes);
        setToast({ text: `Agora só até ${formatMinutes(choice.minutes)}.` });
      } else if (choice.kind === "lighter") {
        setMood("leve");
        setToast({ text: "Agora só coisas leves." });
      } else {
        setDiscovery("beyond");
        setToast({ text: "Agora com títulos menos famosos." });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // O que a pessoa registrou em outra tela (como o Registrar) sai das sugestões
  const [highlight, ...rest] = (feed?.items ?? []).filter((i) => !seen?.has(i.media.id));

  return (
    <div>
      <SeenStamp id={stamp} album={stampAlbum} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Para você, {user?.name.split(" ")[0]}</h1>
          {feed && (
            <p className="mt-1 text-sm text-muted">
              {STRATEGY_LABEL[feed.strategy]} ·{" "}
              <Link to="/como-recomendamos" className="underline hover:text-accent">
                Como escolhemos
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["", "movie", "series", "album"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`chip cursor-pointer px-4 py-1.5 text-sm ${type === t ? "border-accent text-accent" : ""}`}
            >
              {{ "": "Tudo", movie: "Filmes", series: "Séries", album: "Música" }[t]}
            </button>
          ))}
          <button className="btn-ghost px-3 py-1.5" disabled={loading} onClick={swap}>
            ↻ Trocar sugestões
          </button>
        </div>
      </div>

      {type !== "album" && (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Modo descoberta">
          <span className="text-sm text-muted">Quanto sair do óbvio:</span>
          {(
            [
              ["taste", "No meu gosto"],
              ["beyond", "Um pouco além"],
              ["outside", "Fora da sua bolha"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              aria-pressed={discovery === mode}
              onClick={() => setDiscovery(mode)}
              className={`chip cursor-pointer px-3 py-1 text-sm ${discovery === mode ? "border-accent text-accent" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Para agora">
        <span className="text-sm text-muted">Para agora:</span>
        {type !== "album" && (
          <button
            aria-pressed={tonight}
            title={hasServices ? "Até 2h30 e só nos seus serviços" : "Até 2h30. Marque seus serviços para ver só o que você tem"}
            onClick={() => {
              if (tonight) {
                setMaxMinutes(0);
                setOnlyMine(false);
              } else {
                setMaxMinutes(TONIGHT_MINUTES);
                setOnlyMine(hasServices);
              }
            }}
            className={`chip cursor-pointer px-3 py-1 text-sm ${tonight ? "border-accent text-accent" : ""}`}
          >
            🌙 Hoje à noite
          </button>
        )}
        <label className="sr-only" htmlFor="clima">
          Clima
        </label>
        <select
          id="clima"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          className={`chip cursor-pointer bg-surface px-3 py-1 text-sm ${mood ? "border-accent text-accent" : ""}`}
        >
          <option value="">Qualquer clima</option>
          {moods.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        {(
          [
            [0, "Qualquer duração"],
            [90, "Até 1h30"],
            [120, "Até 2h"],
          ] as const
        ).map(([minutes, label]) => (
          <button
            key={minutes}
            aria-pressed={maxMinutes === minutes}
            onClick={() => setMaxMinutes(minutes)}
            className={`chip cursor-pointer px-3 py-1 text-sm ${maxMinutes === minutes ? "border-accent text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
        {maxMinutes !== 0 && maxMinutes !== 90 && maxMinutes !== 120 && (
          <button aria-pressed className="chip cursor-pointer border-accent px-3 py-1 text-sm text-accent" onClick={() => setMaxMinutes(0)}>
            Até {formatMinutes(maxMinutes)} ✕
          </button>
        )}
        <label className="sr-only" htmlFor="ocasiao">
          Com quem
        </label>
        <select
          id="ocasiao"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          className={`chip cursor-pointer bg-surface px-3 py-1 text-sm ${occasion ? "border-accent text-accent" : ""}`}
        >
          <option value="">Com qualquer pessoa</option>
          {occasions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {type !== "album" &&
          (hasServices ? (
            <button
              aria-pressed={onlyMine}
              onClick={() => setOnlyMine(!onlyMine)}
              className={`chip cursor-pointer px-3 py-1 text-sm ${onlyMine ? "border-accent text-accent" : ""}`}
            >
              Só nos meus serviços
            </button>
          ) : (
            <Link to="/conta#servicos" className="text-xs text-muted underline hover:text-accent">
              Marcar os serviços que eu assino
            </Link>
          ))}
        {maxMinutes > 0 && type !== "album" && (
          <span className="text-xs text-muted">Nas séries, vale a duração do episódio.</span>
        )}
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
              <OnMyServices rec={rec} className="mt-1 text-xs" />
              <TuneMenu rec={rec} state={{ mood, maxMinutes, discovery }} onTune={(choice, label) => tune(rec, choice, label)} />
              <Buttons rec={rec} act={act} onSeen={() => setSeenTarget(rec.media)} />
            </MediaCard>
          </OnScreen>
        ))}
      </div>

      {feed && feed.items.length === 0 && !loading && (
        <HandNote className="mt-6">
          {onlyMine
            ? "Nada nos seus serviços com esses filtros. Tente outro clima, outra duração ou tire o filtro dos serviços."
            : "Nada com esses filtros por enquanto. Tente outro clima, outra duração ou outra companhia."}
        </HandNote>
      )}

      {/* Mais sugestões só quando a pessoa pede, como na Busca: nada aparece na tela sem ela querer */}
      {feed && hasMore && !moreFailed && !loading && rest.length > 0 && (
        <div className="mt-10 text-center">
          <button className="btn-ghost px-6" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Procurando mais títulos..." : "Ver mais sugestões"}
          </button>
        </div>
      )}
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
