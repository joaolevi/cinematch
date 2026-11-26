import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { sessionNow } from "../session";
import DoubleFeature from "../components/DoubleFeature";
import Highlight, { Buttons, DismissButton, OnMyServices } from "../components/Highlight";
import Carousel from "../components/Carousel";
import MediaCard from "../components/MediaCard";
import SeenModal from "../components/SeenModal";
import SeenStamp from "../components/SeenStamp";
import Toast from "../components/Toast";
import { OnScreen, useImpressions } from "../impressions";
import { diaryChanged, useSeen } from "../seen";
import TuneMenu, { type Tune } from "../components/TuneMenu";
import { formatMinutes } from "../format";
import { useMoods } from "../moods";
import type { AdjustKind, Discovery, Feed, FeedbackAction, Media, MediaType, Mix, Occasion, Pair, Person, Recommendation, Wish } from "../types";
import { MEDIA_GRID } from "../ui";

// Os cartões das sugestões têm botões embaixo: no celular, ficam em 2 colunas
const FEED_GRID = MEDIA_GRID.replace("grid-cols-3 gap-x-3", "grid-cols-2 gap-x-4");
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import WishBox from "../components/WishBox";
import { Avatar } from "../components/WatchedBy";
import ListName from "../components/ListName";

const PAGE = 30; // em fileiras, 30 sugestões formam fileiras de gênero com pelo menos 3 títulos
const MIN_ROW = 3; // fileira com menos que isso não vale a pena: os títulos vão para "Mais sugestões"

interface Row {
  key: string;
  title: string;
  note?: string;
  items: Recommendation[];
}

/**
 * Agrupa as sugestões em fileiras, como a Netflix e o Spotify. Na ordem: pelo título que puxou a sugestão ("Porque você
 * curtiu Interestelar") ou pela pessoa ("Mais de Christopher Nolan"), quando juntam pelo menos 3; "Nos seus serviços";
 * os discos ("Para ouvir"); e os filmes e séries pelo gênero principal. Cada título entra em uma fileira só; o que sobra
 * fica em "Mais sugestões para você", no fim.
 */
function thematicRows(recs: Recommendation[], withServices: boolean): Row[] {
  const rows: Row[] = [];
  const used = new Set<number>();
  const add = (row: Row) => {
    const items = row.items.filter((r) => !used.has(r.media.id));
    if (items.length < MIN_ROW) return;
    items.forEach((r) => used.add(r.media.id));
    rows.push({ ...row, items });
  };
  // 1. O que puxou a sugestão: um título ou uma pessoa
  const reasons = new Map<string, Row>();
  for (const rec of recs) {
    const b = rec.because;
    if (!b || (b.kind !== "title" && b.kind !== "person")) continue;
    const key = `${b.kind}:${b.value}`;
    if (!reasons.has(key)) {
      reasons.set(key, { key, title: b.kind === "title" ? `Porque você curtiu ${b.label}` : `Mais de ${b.label}`, items: [] });
    }
    reasons.get(key)!.items.push(rec);
  }
  [...reasons.values()].sort((a, b) => b.items.length - a.items.length).forEach(add);
  // 2. Nos seus serviços
  if (withServices) {
    add({ key: "servicos", title: "Nos seus serviços", note: "pra ver hoje", items: recs.filter((r) => (r.services?.length ?? 0) > 0) });
  }
  // 3. Os discos
  add({ key: "ouvir", title: "Para ouvir", note: "do jeito que você ouve", items: recs.filter((r) => r.media.type === "album") });
  // 4. Os filmes e séries pelo gênero principal
  const genres = new Map<string, Recommendation[]>();
  for (const rec of recs) {
    const genre = rec.media.genres[0];
    if (!genre || used.has(rec.media.id) || rec.media.type === "album") continue;
    genres.set(genre, [...(genres.get(genre) ?? []), rec]);
  }
  [...genres.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([genre, items]) => add({ key: `genero:${genre}`, title: genre, note: "escolhidos pelo seu gosto", items }));
  const others = recs.filter((r) => !used.has(r.media.id));
  if (others.length) rows.push({ key: "mais", title: rows.length ? "Mais sugestões para você" : "Sugestões para você", items: others });
  return rows;
}

/** Mixes de música, como os do Spotify: um mosaico com as capas, o nome e quem toca; os discos em fileira. */
function Mixes({ mixes }: { mixes: Mix[] }) {
  return (
    <section className="mt-10" aria-label="Mixes para você">
      <h2 className="mb-4 font-display text-2xl font-bold">
        Seus mixes
        <span className="block font-hand text-xl font-bold text-accent sm:ml-3 sm:inline">do jeito que você ouve</span>
      </h2>
      <div className="space-y-8">
        {mixes.map((mix) => (
          <div key={mix.title} className="grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)]">
            <div className="flex items-center gap-4 md:block">
              <div aria-hidden className="grid w-28 shrink-0 grid-cols-2 overflow-hidden rounded-xl shadow-lg md:w-44">
                {mix.items.slice(0, 4).map((m) =>
                  m.poster_url ? (
                    <img key={m.id} src={m.poster_url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  ) : (
                    <span key={m.id} className="aspect-square w-full bg-surface-2" />
                  ),
                )}
              </div>
              <div className="md:mt-3">
                <h3 className="font-display text-lg leading-tight font-bold">{mix.title}</h3>
                <p className="mt-0.5 text-sm text-muted">{mix.subtitle}</p>
              </div>
            </div>
            <Carousel label={mix.title}>
              {mix.items.map((m) => (
                <div key={m.id} className="w-36 shrink-0 snap-start pt-2">
                  <MediaCard media={m} compact />
                </div>
              ))}
            </Carousel>
          </div>
        ))}
      </div>
    </section>
  );
}

// A Sessão pipoca acompanha a hora do dia (session.ts): a duração muda de manhã, à tarde, à noite e de madrugada
const SESSION = sessionNow();
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
  const [mixes, setMixes] = useState<Mix[]>([]);
  // Os mixes de música aparecem na aba Música
  useEffect(() => {
    if (type === "album" && mixes.length === 0) api.mixes().then(setMixes).catch(() => {});
  }, [type, mixes.length]);
  const [discovery, setDiscovery] = useState<Discovery>("taste");
  // Momento (RFF20): clima e duração máxima; vazio e 0 = qualquer um
  const [mood, setMood] = useState("");
  // Do Início dá para chegar já com a Sessão pipoca ligada (?hoje=1) ou com um pedido feito (?pedido=...)
  const [params] = useSearchParams();
  const fromTonight = params.get("hoje") === "1";
  const [maxMinutes, setMaxMinutes] = useState(fromTonight ? SESSION.minutes : 0);
  const [occasion, setOccasion] = useState("");
  const [onlyMine, setOnlyMine] = useState(fromTonight && (user?.services.length ?? 0) > 0); // só nos meus serviços (RFF21)
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
  // O painel de pedir e filtrar pode ser escondido, e a escolha fica neste navegador. Sem escolha, ele começa aberto
  // no computador e recolhido no celular, para a primeira sugestão aparecer sem rolar
  const [showFilters, setShowFiltersState] = useState(() => {
    try {
      const saved = localStorage.getItem("tastory.paravoce.filtros");
      if (saved) return saved === "abertos";
    } catch {
      /* sem armazenamento: vale o padrão */
    }
    return typeof window !== "undefined" && window.innerWidth >= 640;
  });
  const setShowFilters = (open: boolean) => {
    setShowFiltersState(open);
    try {
      localStorage.setItem("tastory.paravoce.filtros", open ? "abertos" : "escondidos");
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  };
  const activeFilters =
    [discovery !== "taste", mood, maxMinutes, occasion, onlyMine, companions.length > 0].filter(Boolean).length;
  const tonight = maxMinutes === SESSION.minutes && onlyMine === hasServices;
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
  const card = (rec: Recommendation) => (
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
  );

  const [highlight, ...rest] = (feed?.items ?? []).filter(
    (i) => !seen?.has(i.media.id) && !inPairs.has(i.media.id) && (!together || !type || i.media.type === type),
  );
  const chosen = following.filter((p) => companions.includes(p.id));
  // As sugestões para um grupo não entram na comparação A/B, que mede o feed de cada pessoa
  const markShown = together ? () => {} : impressions.mark;
  const rows = thematicRows(rest, !onlyMine);

  return (
    <div>
      <SeenStamp id={stamp} album={stampAlbum} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Para você, {user?.name.split(" ")[0]}</h1>
          <p className="font-hand text-2xl font-bold text-accent">sempre com o porquê</p>
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

      {/* Os destaques do Tastory ficam à vista: pedir em português, "Hoje à noite" e ver junto com alguém. O resto dos
          filtros fica no painel de baixo, que se esconde */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Pedir do seu jeito" className="rise relative flex flex-col justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-surface/80 to-accent/10 p-5 sm:p-6">
          <WishBox big onWish={applyWish} initial={params.get("pedido") ?? undefined} />
        </section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {type !== "album" && (
            <button
              aria-pressed={tonight}
              onClick={() => {
                if (tonight) {
                  setMaxMinutes(0);
                  setOnlyMine(false);
                } else {
                  setMaxMinutes(SESSION.minutes);
                  setOnlyMine(hasServices);
                }
              }}
              style={{ "--i": 1 } as React.CSSProperties}
              className={`rise group relative cursor-pointer overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left transition ${SESSION.sky} ${
                tonight ? "border-accent" : "border-line hover:border-accent/60"
              }`}
            >
              {/* O céu de agora: o ícone da hora do dia e, à noite, umas estrelas */}
              <span aria-hidden className="float absolute top-3 right-4 text-3xl" style={{ "--tilt": "-12deg" } as React.CSSProperties}>
                {SESSION.icon}
              </span>
              {SESSION.stars && (
                <>
                  <span aria-hidden className="absolute top-8 right-16 h-1 w-1 rounded-full bg-cream/70" />
                  <span aria-hidden className="absolute top-4 right-24 h-0.5 w-0.5 rounded-full bg-cream/60" />
                </>
              )}
              <span className="block font-hand text-2xl leading-7 font-bold text-accent">Sessão pipoca</span>
              <span className="mt-1 block pr-10 text-sm text-stone-300">
                Agora {SESSION.when}: {SESSION.text}
                {hasServices && ", nos seus serviços"}
              </span>
              <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${tonight ? "bg-accent text-bg" : "bg-white/10 text-cream group-hover:bg-accent group-hover:text-bg"}`}>
                {tonight ? "Ligado" : "Ligar"}
              </span>
            </button>
          )}
          <section
            aria-label="Gosto em dupla"
            style={{ "--i": 2 } as React.CSSProperties}
            className={`rise rounded-2xl border p-4 ${together ? "border-accent bg-accent/10" : "border-line bg-surface/70"}`}
          >
            <p className="font-hand text-2xl leading-7 font-bold text-accent">Gosto em dupla</p>
            <p className="mt-1 text-sm text-stone-300">
              {together ? `Sugestões para você e ${chosen.map((p) => p.name.split(" ")[0]).join(" e ")}` : "Sugestões que agradam aos dois"}
            </p>
            {following.length === 0 ? (
              <Link to="/comunidade/pessoas" className="mt-2 inline-block text-xs text-muted underline hover:text-accent">
                Seguir alguém para ver junto
              </Link>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {following.slice(0, 6).map((person) => {
                  const on = companions.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      aria-pressed={on}
                      aria-label={`${on ? "Tirar" : "Ver junto com"} ${person.name}`}
                      title={person.name}
                      disabled={!on && companions.length >= MAX_COMPANIONS}
                      onClick={() => setCompanions(on ? companions.filter((id) => id !== person.id) : [...companions, person.id])}
                      className={`cursor-pointer rounded-full p-0.5 transition hover:-translate-y-0.5 disabled:opacity-40 ${on ? "ring-2 ring-accent" : "ring-1 ring-line"}`}
                    >
                      <Avatar name={person.name} userId={person.id} size="h-9 w-9 text-sm" />
                    </button>
                  );
                })}
                {together && (
                  <button className="ml-1 text-xs text-muted underline hover:text-accent" onClick={() => setCompanions([])}>
                    Só para mim
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Os outros filtros: quanto sair do óbvio e o momento (clima, ocasião, duração, serviços) */}
      <section aria-label="Ajustar as sugestões" className={`mt-5 rounded-2xl border border-line bg-surface/70 ${showFilters ? "p-4 sm:p-5" : "px-4 py-2.5 sm:px-5"}`}>
        {/* A linha de cima esconde e mostra o painel. Escondido, ela diz quantos filtros estão ligados */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-hand text-xl leading-7 font-bold text-accent">
            Mais filtros
            {!showFilters && activeFilters > 0 && (
              <span className="ml-2 font-sans text-sm font-semibold text-stone-300">
                {activeFilters} {activeFilters === 1 ? "filtro ligado" : "filtros ligados"}
              </span>
            )}
          </p>
          <button
            className="btn-ghost px-3 py-1 text-sm"
            aria-expanded={showFilters}
            aria-controls="filtros-do-feed"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? "Esconder" : "Mostrar"}
          </button>
        </div>
        <div id="filtros-do-feed" className={showFilters ? "mt-3" : "hidden"}>
        <div className="grid gap-5 border-t border-line pt-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-0 lg:divide-x lg:divide-line">
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

        </div>
        </div>
        {activeFilters > 0 && (
          <button className="mt-2 text-xs text-muted underline hover:text-accent" onClick={clearFilters}>
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

      {type === "album" && mixes.length > 0 && <Mixes mixes={mixes} />}

      {/* Fileiras temáticas, como na Netflix e no Spotify: "Porque você curtiu...", "Nos seus serviços"... Sem fileiras
          que valham a pena (pelo menos 3 títulos cada), fica a grade de antes */}
      {rows.length > 1 ? (
        <div className="mt-10 space-y-12">
          {rows.map((row) => (
            <section key={row.key} aria-label={row.title}>
              <h2 className="mb-4 font-display text-2xl font-bold">
                {row.title}
                {row.note && <span className="block font-hand text-xl font-bold text-accent sm:ml-3 sm:inline">{row.note}</span>}
              </h2>
              <Carousel label={row.title}>
                {row.items.map((rec) => (
                  <div key={rec.media.id} className="flex w-44 shrink-0 snap-start pt-2 sm:w-48">
                    {card(rec)}
                  </div>
                ))}
              </Carousel>
            </section>
          ))}
        </div>
      ) : (
        <div className={`mt-8 ${FEED_GRID}`}>{rest.map(card)}</div>
      )}

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
