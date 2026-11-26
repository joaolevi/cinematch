import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import DoubleFeature from "../components/DoubleFeature";
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
import type { AdjustKind, Discovery, Feed, FeedbackAction, Media, MediaType, Occasion, Pair, Person, Recommendation, Wish } from "../types";
import { MEDIA_GRID } from "../ui";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import WishBox from "../components/WishBox";
import { Avatar } from "../components/WatchedBy";
import ListName from "../components/ListName";

const PAGE = 18;
const TONIGHT_MINUTES = 150; // "Hoje à noite": cabe numa noite, até 2h30
const MAX_COMPANIONS = 4; // quem pede e mais quatro pessoas (RFF28)

/** "Levi", "Levi e Bia", "Levi, Bia e Caio" */
function names(people: Person[]): string {
  const first = people.map((p) => p.name.split(" ")[0]);
  return first.length > 1 ? `${first.slice(0, -1).join(", ")} e ${first[first.length - 1]}` : first[0];
}

const STRATEGY_LABEL: Record<Feed["strategy"], string> = {
  hybrid: "Escolhidos a dedo, com base no seu gosto e em quem curte coisas parecidas",
  content: "Escolhidos a dedo, com base no que você curte",
  trending: "O que está em alta agora. Conte o que você curte e isso aqui fica com a sua cara",
  bridge: "Discos parecidos com os que você ouve, e discos ligados aos filmes e séries que você curte",
  discovery: "Discos de gêneros que você ainda não ouve",
};

/** Um grupo do painel de filtros, com o título em cima. Nas telas largas, os grupos ficam lado a lado. */
function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="lg:px-5 lg:first:pl-0 lg:last:pr-0">
      <p className="text-xs font-bold tracking-wide text-muted uppercase">{title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Opções que se excluem, como abas: uma pílula só, com a escolhida preenchida. */
function Segmented<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap rounded-2xl border border-line bg-bg/40 p-0.5 sm:flex-nowrap sm:rounded-full sm:whitespace-nowrap">
      {options.map(([option, text]) => (
        <button
          key={String(option)}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-sm transition ${
            value === option ? "bg-accent font-bold text-bg" : "text-stone-300 hover:text-cream"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

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
  // Para ver ou ouvir junto (RFF28): quem eu sigo e quem escolhi para hoje
  const [following, setFollowing] = useState<Person[]>([]);
  const [companions, setCompanions] = useState<number[]>([]);
  const together = companions.length > 0;
  useEffect(() => {
    api.occasions().then(setOccasions).catch(() => {});
    api.following().then(setFollowing).catch(() => {});
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
  const [showFilters, setShowFilters] = useState(false); // no celular, os filtros começam recolhidos
  const activeFilters =
    [discovery !== "taste", mood, maxMinutes, occasion, onlyMine, companions.length > 0].filter(Boolean).length;
  const tonight = maxMinutes === TONIGHT_MINUTES && onlyMine === hasServices;
  function clearFilters() {
    setDiscovery("taste");
    setMood("");
    setMaxMinutes(0);
    setOccasion("");
    setOnlyMine(false);
    setCompanions([]);
  }
  // Pedido em português (RFF25): um pedido novo troca todos os filtros; limpar volta tudo ao padrão
  function applyWish(wish: Wish | null) {
    setType(wish?.type ?? "");
    setDiscovery(wish?.discovery ?? "taste");
    setMood(wish?.mood ?? "");
    setMaxMinutes(wish?.max_minutes ?? 0);
    setOccasion(wish?.occasion ?? "");
    setOnlyMine(Boolean(wish?.only_mine) && hasServices);
  }
  const [feed, setFeed] = useState<Feed | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]); // sessão dupla (RFF27), só no feed misto
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
      // Junto com outras pessoas, a lista vem inteira de uma vez, sem paginação
      const first: Feed = together
        ? { variant: "-", strategy: "hybrid", items: await api.togetherNow(companions, moment, 30) }
        : await api.feed(type || undefined, PAGE, [], discovery, moment);
      if (thisLoad === latestLoad.current) {
        alreadyShown.current = new Set(first.items.map((i) => i.media.id));
        setFeed(first);
        if (together) setHasMore(false);
        setPairs([]);
        // A sessão dupla usa outros filmes, para não repetir o que já está na tela
        if (!together && !type) {
          api
            .pairs(first.items.map((i) => i.media.id), moment)
            .then((found) => thisLoad === latestLoad.current && setPairs(found))
            .catch(() => {});
        }
      }
    } catch (e) {
      if (thisLoad === latestLoad.current) setError((e as Error).message);
    } finally {
      if (thisLoad === latestLoad.current) {
        replacing.current = false;
        setLoading(false);
      }
    }
  }, [type, discovery, moment, together, companions]);

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
    if (together) return load();
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
    if (rec && !together) impressions.mark(rec);
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

  // O que a pessoa registrou em outra tela (como o Registrar) sai das sugestões. Junto com outras pessoas, a lista
  // vem com as três mídias, e o filtro de tipo é feito aqui
  const inPairs = new Set(pairs.flatMap((p) => [p.video.media.id, p.album.id]));
  const [highlight, ...rest] = (feed?.items ?? []).filter(
    (i) => !seen?.has(i.media.id) && !inPairs.has(i.media.id) && (!together || !type || i.media.type === type),
  );
  const chosen = following.filter((p) => companions.includes(p.id));
  // As sugestões para um grupo não entram na comparação A/B, que mede o feed de cada pessoa
  const markShown = together ? () => {} : impressions.mark;

  return (
    <div>
      <SeenStamp id={stamp} album={stampAlbum} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Para você, {user?.name.split(" ")[0]}</h1>
          {feed && (
            <p className="mt-1 text-sm text-muted">
              {together
                ? `Para ver ou ouvir junto com ${names(chosen)}: primeiro o que agrada a todo mundo`
                : STRATEGY_LABEL[feed.strategy]}{" "}
              ·{" "}
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

      {/* Um painel só para pedir e filtrar: o pedido em português em cima e, embaixo, três grupos com título */}
      <section aria-label="Ajustar as sugestões" className="mt-5 rounded-2xl border border-line bg-surface/70 p-4 sm:p-5">
        <WishBox onWish={applyWish} />

        {/* No celular, os grupos ficam recolhidos: a primeira sugestão aparece sem rolar. Com algum ligado, o botão diz quantos */}
        <button
          className="btn-ghost mt-3 px-3 py-1 text-sm sm:hidden"
          aria-expanded={showFilters}
          aria-controls="filtros-do-feed"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? "Esconder os filtros" : activeFilters ? `Ajustar os filtros (${activeFilters} ligados)` : "Ajustar os filtros"}
        </button>
        <div
          id="filtros-do-feed"
          className={`mt-4 grid gap-5 border-t border-line pt-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-0 lg:divide-x lg:divide-line ${showFilters ? "" : "max-sm:hidden"}`}
        >
          {type !== "album" && !together && (
            <FilterGroup title="Quanto sair do óbvio">
              <Segmented
                label="Modo descoberta"
                value={discovery}
                onChange={setDiscovery}
                options={[
                  ["taste", "No meu gosto"],
                  ["beyond", "Um pouco além"],
                  ["outside", "Fora da bolha"],
                ]}
              />
            </FilterGroup>
          )}

          <FilterGroup title="Para agora">
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
                className={`chip cursor-pointer px-3 py-1 text-sm ${tonight ? "border-accent bg-accent/15 text-accent" : ""}`}
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
            <label className="sr-only" htmlFor="ocasiao">
              Ocasião
            </label>
            <select
              id="ocasiao"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className={`chip cursor-pointer bg-surface px-3 py-1 text-sm ${occasion ? "border-accent text-accent" : ""}`}
            >
              <option value="">Qualquer ocasião</option>
              {occasions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <Segmented
              label="Duração"
              value={[0, 90, 120].includes(maxMinutes) ? maxMinutes : -1}
              onChange={setMaxMinutes}
              options={[
                [0, "Qualquer duração"],
                [90, "Até 1h30"],
                [120, "Até 2h"],
              ]}
            />
            {maxMinutes !== 0 && maxMinutes !== 90 && maxMinutes !== 120 && (
              <button aria-pressed className="chip cursor-pointer border-accent px-3 py-1 text-sm text-accent" onClick={() => setMaxMinutes(0)}>
                Até {formatMinutes(maxMinutes)} ✕
              </button>
            )}
            {type !== "album" &&
              (hasServices ? (
                <button
                  aria-pressed={onlyMine}
                  onClick={() => setOnlyMine(!onlyMine)}
                  className={`chip cursor-pointer px-3 py-1 text-sm ${onlyMine ? "border-accent bg-accent/15 text-accent" : ""}`}
                >
                  Só nos meus serviços
                </button>
              ) : (
                <Link to="/conta#servicos" className="self-center text-xs text-muted underline hover:text-accent">
                  Marcar os serviços que eu assino
                </Link>
              ))}
            {maxMinutes > 0 && type !== "album" && (
              <span className="w-full text-xs text-muted">Nas séries, vale a duração do episódio.</span>
            )}
          </FilterGroup>

          <FilterGroup title="Junto com">
            {following.length === 0 ? (
              <Link to="/comunidade" className="text-xs text-muted underline hover:text-accent">
                Seguir alguém na Comunidade para ver junto
              </Link>
            ) : (
              <>
                {following.map((person) => {
                  const on = companions.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      aria-pressed={on}
                      disabled={!on && companions.length >= MAX_COMPANIONS}
                      onClick={() => setCompanions(on ? companions.filter((id) => id !== person.id) : [...companions, person.id])}
                      className={`chip flex cursor-pointer items-center gap-1.5 py-0.5 pr-3 pl-0.5 text-sm ${on ? "border-accent bg-accent/15 text-accent" : ""}`}
                    >
                      <Avatar name={person.name} userId={person.id} size="h-6 w-6 text-xs" />
                      {person.name.split(" ")[0]}
                    </button>
                  );
                })}
                {together && (
                  <button className="text-xs text-muted underline hover:text-accent" onClick={() => setCompanions([])}>
                    Ver só para mim
                  </button>
                )}
              </>
            )}
          </FilterGroup>
        </div>
        {activeFilters > 0 && (
          <button className="mt-3 text-xs text-muted underline hover:text-accent" onClick={clearFilters}>
            Limpar os filtros
          </button>
        )}
      </section>

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
        <OnScreen key={highlight.media.id} rec={highlight} onSeen={markShown}>
          <Highlight
            rec={highlight}
            label={together ? "Nossa aposta para vocês" : feed?.strategy === "trending" ? "Em alta agora" : "Nossa aposta para você"}
            act={act}
            onSeen={() => setSeenTarget(highlight.media)}
          />
        </OnScreen>
      )}

      <DoubleFeature
        pairs={pairs.filter((p) => !seen?.has(p.video.media.id) && !seen?.has(p.album.id))}
        onSaved={(pair) => {
          setPairs((all) => all.filter((p) => p !== pair));
          setToast({
            text: (
              <>
                Anotado! "{pair.video.media.title}" e "{pair.album.title}" estão na sua lista <ListName />
              </>
            ),
          });
        }}
      />

      <div className={`mt-8 ${MEDIA_GRID}`}>
        {rest.map((rec) => (
          <OnScreen key={rec.media.id} rec={rec} onSeen={markShown}>
            <MediaCard media={rec.media} overlay={<DismissButton onClick={() => act(rec.media, "dismiss")} />}>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted" title={rec.reason}>
                {rec.reason}
              </p>
              <OnMyServices rec={rec} className="mt-1 text-xs" logos={false} />
              <TuneMenu rec={rec} state={{ mood, maxMinutes, discovery }} onTune={(choice, label) => tune(rec, choice, label)} />
              <Buttons rec={rec} act={act} onSeen={() => setSeenTarget(rec.media)} />
            </MediaCard>
          </OnScreen>
        ))}
      </div>

      {feed && feed.items.length === 0 && !loading && (
        <HandNote className="mt-6">
          {together
            ? "Nada para vocês com esses filtros. Tente outro clima, outra duração ou menos gente."
            : onlyMine
            ? "Nada nos seus serviços com esses filtros. Tente outro clima, outra duração ou tire o filtro dos serviços."
            : "Nada com esses filtros por enquanto. Tente outro clima, outra duração ou outra ocasião."}
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
      {feed && !hasMore && !loading && !together && (
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
