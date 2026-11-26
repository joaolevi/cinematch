import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import Carousel from "../components/Carousel";
import MediaCard from "../components/MediaCard";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import ActionIcon from "../components/ActionIcon";
import Episodes from "../components/Episodes";
import { episodePath } from "./EpisodePage";
import Tracks from "../components/Tracks";
import TrailerButton from "../components/TrailerButton";
import ShareButton from "../components/ShareButton";
import RatingsPanel from "../components/RatingsPanel";
import ReviewTalk from "../components/ReviewTalk";
import SpoilerText from "../components/SpoilerText";
import SeenModal from "../components/SeenModal";
import SeenStamp from "../components/SeenStamp";
import { diaryChanged, useDiaryVersion } from "../seen";
import { StarsDisplay } from "../components/Stars";
import { Avatar } from "../components/WatchedBy";
import { colorFor, formatDate, MEDIA_STYLE, plural, SEARCH_URL, SERVICE_LABEL, timeAgo, verbs } from "../format";
import type { Connection, Media, MediaDetail, Provider, Season, UserList } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";
import { moodLabel, useMoods } from "../moods";
import HandNote from "../components/HandNote";

function PeopleLinks({ names }: { names: string[] }) {
  return (
    <dd>
      {names.map((name, position) => (
        <span key={name}>
          {position > 0 && ", "}
          <Link to={`/buscar?pessoa=${encodeURIComponent(name)}`} className="hover:text-accent hover:underline">
            {name}
          </Link>
        </span>
      ))}
    </dd>
  );
}

/** Legenda da polaroide no detalhe, escrita à mão: "vi em 8 de nov." ou "já vi"; num álbum, "ouvi". */
function statusCaption(status: MediaDetail["my_status"], album: boolean): string {
  if (status.status === "watching") return status.season ? `assistindo a T${status.season}` : "assistindo";
  const verb = album ? "ouvi" : "vi";
  if (status.diary_entry_id && status.consumed_at) {
    const day = new Date(`${status.consumed_at}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    return `${verb} em ${day}`;
  }
  return `já ${verb}`;
}


/** Onde ouvir um álbum: o link do próprio disco quando existe; senão, a busca do disco no serviço. */
function ListenLinks({ media }: { media: Media }) {
  const own = new Map((media.links ?? []).filter((l) => l.level === "album").map((l) => [l.service, l.url]));
  const query = encodeURIComponent(`${media.title} ${media.creators[0] ?? ""}`.trim());
  const services = [...new Set([...own.keys(), ...Object.keys(SEARCH_URL)])];
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">Onde ouvir</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {services.map((service) => {
          const name = SERVICE_LABEL[service] ?? service;
          const url = own.get(service) ?? SEARCH_URL[service]?.(query);
          if (!url) return null;
          return (
            <a key={service} href={url} target="_blank" rel="noreferrer" className="chip transition hover:border-accent hover:text-accent">
              {own.has(service) ? `Ouvir no ${name}` : `Procurar no ${name}`} ↗
            </a>
          );
        })}
      </div>
    </div>
  );
}

const PROVIDER_KIND: Record<Provider["kind"], string> = { flatrate: "Na assinatura", rent: "Para alugar", buy: "Para comprar" };

/** O nome do serviço sem o plano nem o canal: "Netflix Standard with Ads" e "Paramount+ Amazon Channel" viram a marca. */
function brandOf(name: string): string {
  return name
    .replace(/\s+(Standard|Basic|Premium)?\s*with Ads$/i, "")
    .replace(/\s+Amazon Channel$/i, "")
    .replace(/\s+Premium$/i, "")
    .replace(/\s+Plus$/i, "+")
    .trim();
}

/** Onde assistir no Brasil (RFF19): os serviços por tipo, um por marca, com o crédito exigido da JustWatch. */
function WatchProviders({ providers }: { providers: Provider[] }) {
  const link = providers.find((p) => p.link)?.link;
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">Onde assistir no Brasil</p>
      <div className="mt-2 space-y-2">
        {(Object.keys(PROVIDER_KIND) as Provider["kind"][]).map((kind) => {
          const brands = new Map<string, Provider>();
          for (const p of providers) if (p.kind === kind && !brands.has(brandOf(p.service))) brands.set(brandOf(p.service), p);
          if (brands.size === 0) return null;
          return (
            <div key={kind} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="shrink-0 text-xs text-muted sm:w-28">{PROVIDER_KIND[kind]}</span>
              <div className="flex flex-wrap gap-2">
                {[...brands].map(([brand, p]) => (
                  <span key={brand} className="chip flex items-center gap-1.5 py-0.5 pl-0.5">
                    {p.logo && <img src={p.logo} alt="" className="h-6 w-6 rounded-md" loading="lazy" />}
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        {link && (
          <>
            <a href={link} target="_blank" rel="noreferrer" className="underline hover:text-accent">Ver os links de cada serviço</a> ·{" "}
          </>
        )}
        Dados de onde assistir:{" "}
        <a href="https://www.justwatch.com/br" target="_blank" rel="noreferrer" className="underline hover:text-accent">JustWatch</a>
      </p>
    </div>
  );
}

/** Cada título monta a página do zero, para nada do título anterior sobrar na tela. */
export default function MediaPage() {
  const { id } = useParams();
  const reviewsOnly = useLocation().pathname.endsWith("/resenhas");
  return <MediaView key={id} mediaId={Number(id)} reviewsOnly={reviewsOnly} />;
}


/** Série que a pessoa está assistindo (RFF24): em que temporada ela está, com troca rápida. */
/**
 * "Continuar assistindo", como na Netflix e na HBO: em que temporada a pessoa está, quantos episódios viu e o próximo
 * episódio. A temporada troca nos botões T1, T2...; marcar um episódio também muda a temporada sozinho.
 */
function WatchingSeason({
  mediaId,
  entryId,
  season,
  seasons,
  counts,
  onChange,
}: {
  mediaId: number;
  entryId: number;
  season: number | null;
  seasons: Season[];
  counts: Record<string, number>;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function pick(value: number) {
    setSaving(true);
    try {
      await api.updateDiary(entryId, { season: value });
      onChange();
    } finally {
      setSaving(false);
    }
  }
  const current = seasons.find((t) => t.number === season);
  const seen = season != null ? counts[String(season)] ?? 0 : 0;
  const total = current?.episodes ?? null;
  const next = season != null && (total == null || seen < total) ? seen + 1 : null;
  return (
    <div className="mt-4 max-w-xl rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-bold text-accent">▶ Você está assistindo</span>
        {season != null && <span className="font-semibold">Temporada {season}</span>}
      </p>
      {season != null && total != null && (
        <div className="mt-2">
          <div
            role="progressbar"
            aria-label={`Episódios vistos da temporada ${season}`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={Math.min(seen, total)}
            className="h-1.5 overflow-hidden rounded-full bg-line/60"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (seen / total) * 100)}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-muted">
            <span>
              {seen} de {plural(total, "episódio visto", "episódios vistos")}
            </span>
            {next != null && next <= total && (
              <Link to={episodePath(mediaId, season, next)} className="font-semibold text-accent hover:underline">
                Próximo: episódio {next} →
              </Link>
            )}
          </p>
        </div>
      )}
      {seasons.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Em que temporada você está?">
          <span className="text-xs text-muted">Em que temporada você está?</span>
          {seasons.map((t) => (
            <button
              key={t.number}
              disabled={saving}
              aria-pressed={t.number === season}
              aria-label={`Temporada ${t.number}`}
              onClick={() => t.number !== season && pick(t.number)}
              className={`h-8 min-w-8 cursor-pointer rounded-full border px-2 text-xs font-bold transition ${
                t.number === season ? "border-accent bg-accent text-bg" : "border-line text-stone-300 hover:border-accent hover:text-accent"
              }`}
            >
              T{t.number}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Quando acabar a série, use “Terminei” para dar a nota.</p>
    </div>
  );
}

function MediaView({ mediaId, reviewsOnly = false }: { mediaId: number; reviewsOnly?: boolean }) {
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const moods = useMoods();
  const [lists, setLists] = useState<UserList[]>([]);
  const [similar, setSimilar] = useState<Media[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showSeen, setShowSeen] = useState(false);
  const [reviewTab, setReviewTab] = useState<"populares" | "recentes" | "seguindo">("populares");
  const [params, setParams] = useSearchParams();
  const [fullOverview, setFullOverview] = useState(false); // no celular, a sinopse começa em 4 linhas
  const [stamp, setStamp] = useState(0);
  // A cena larga vem do TMDB; se não carregar, o topo fecha em vez de ficar um vazio escuro
  const [brokenBackdrop, setBrokenBackdrop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latestLoad = useRef(0); // se duas cargas se cruzarem, vale a mais recente

  const load = useCallback(async () => {
    const thisLoad = ++latestLoad.current;
    try {
      const [m, l] = await Promise.all([api.media(mediaId), api.lists()]);
      if (thisLoad !== latestLoad.current) return;
      setMedia(m);
      setLists(l);
      setError(null);
    } catch (e) {
      if (thisLoad === latestLoad.current) setError((e as Error).message);
    }
  }, [mediaId]);

  // Recarrega quando o diário muda em outra janela, como o Registrar
  const version = useDiaryVersion();
  useEffect(() => {
    load();
  }, [load, version]);

  useEffect(() => {
    api.similar(mediaId).then(setSimilar).catch(() => {});
    api.connections(mediaId).then(setConnections).catch(() => {});
    api.providers(mediaId).then(setProviders).catch(() => {});
    window.scrollTo(0, 0);
  }, [mediaId]);

  usePageTitle(media?.title);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!media) return <HandNote>Abrindo o diário nesta página...</HandNote>;

  const watchlist = lists.find((l) => l.is_watchlist);
  const customLists = lists.filter((l) => !l.is_watchlist);
  const status = media.my_status;
  // Resenhas como no Letterboxd: as mais curtidas primeiro, as recentes ou só as de quem eu sigo
  const shownReviews =
    reviewTab === "populares"
      ? [...media.reviews].sort((a, b) => b.likes - a.likes || b.created_at.localeCompare(a.created_at))
      : reviewTab === "seguindo"
        ? media.reviews.filter((r) => r.following)
        : media.reviews;
  // Na música, os cards de "Para ver depois" costumam ter o mesmo motivo: ele vai uma vez só, no subtítulo
  const sameReason = connections.length > 1 && connections.every((c) => c.reason === connections[0].reason);
  const album = media.type === "album";
  const words = verbs(media.type);

  async function toggleList(list: UserList, inList: boolean) {
    if (inList) {
      await api.removeFromList(list.id, mediaId);
    } else {
      if (status.dismissed) await api.undoDismiss(mediaId);
      // A watchlist passa pelo feedback para contar na taxa de aceitação
      if (list.is_watchlist) await api.feedback(mediaId, "want");
      else await api.addToList(list.id, mediaId);
    }
    load();
  }

  // Séries (RFF24): começar a acompanhar, na primeira temporada quando sabemos quais são
  async function startWatching(season: number | null) {
    await api.watching(mediaId, season);
    diaryChanged();
    await load();
  }

  async function toggleDismiss() {
    if (status.dismissed) await api.undoDismiss(mediaId);
    else await api.feedback(mediaId, "dismiss");
    load();
  }

  // A janela do Já vi, a mesma na página do título e na das resenhas
  const seenModal = showSeen && (
    <SeenModal
      media={media}
      initialRating={status.rating}
      initialDate={status.consumed_at}
      initialSpoiler={status.spoiler ?? false}
      withSpoiler
      onClose={() => setShowSeen(false)}
      onDelete={
        status.diary_entry_id
          ? async () => {
              await api.deleteDiary(status.diary_entry_id!);
              diaryChanged();
              setShowSeen(false);
              load();
            }
          : undefined
      }
      onConfirm={async (rating, review, date, spoiler) => {
        if (status.diary_entry_id) {
          await api.updateDiary(status.diary_entry_id, {
            rating,
            consumed_at: date,
            spoiler,
            ...(review ? { review } : {}),
          });
        } else {
          await api.feedback(mediaId, "seen", rating, review, date);
          // O "Já vi" pela sugestão não leva o spoiler: ele é marcado no registro que acabou de nascer
          if (spoiler) {
            const created = (await api.media(mediaId)).my_status.diary_entry_id;
            if (created) await api.updateDiary(created, { spoiler: true });
          }
          setStamp(Date.now());
        }
        diaryChanged();
        setShowSeen(false);
        load();
      }}
    />
  );

  type Tab = "episodios" | "faixas" | "resenhas" | "ligados" | "parecidos";
  const tabs = (
    [
      media.type === "series" && media.seasons.length > 0 && ["episodios", "Episódios", media.seasons.length],
      album && ["faixas", "Faixas", null],
      ["resenhas", "Resenhas", media.reviews.length],
      connections.length > 0 && ["ligados", album ? "Para ver depois" : "Para ouvir depois", connections.length],
      similar.length > 0 && ["parecidos", album ? "Parecidos" : media.type === "series" ? "Parecidas" : "Parecidos", null],
    ] as (false | [Tab, string, number | null])[]
  ).filter((t): t is [Tab, string, number | null] => !!t);
  const asked = (reviewsOnly ? "resenhas" : params.get("aba")) as Tab | null;
  const tab: Tab = tabs.find(([key]) => key === asked)?.[0] ?? tabs[0][0];

  // As resenhas, todas, na aba Resenhas
  const reviewsSection = () => (
        <section className="max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">Resenhas</h2>
            {media.reviews.length > 1 && (
              <div role="group" aria-label="Ordem das resenhas" className="inline-flex rounded-full border border-line bg-bg/40 p-0.5">
                {(
                  [
                    ["populares", "Populares"],
                    ["recentes", "Recentes"],
                    ["seguindo", "De quem eu sigo"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={reviewTab === key}
                    onClick={() => setReviewTab(key)}
                    className={`cursor-pointer rounded-full px-3 py-0.5 text-sm transition ${
                      reviewTab === key ? "bg-accent font-bold text-bg" : "text-stone-300 hover:text-cream"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {media.reviews.length === 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <HandNote>Ninguém escreveu sobre este {media.type === "album" ? "álbum" : "título"} ainda. Que tal ser a primeira pessoa?</HandNote>
              <button className="btn-ghost px-4 py-1.5 text-sm" onClick={() => setShowSeen(true)}>
                Escrever uma resenha
              </button>
            </div>
          )}
          <div className="mt-2 divide-y divide-line/60">
            {reviewTab === "seguindo" && shownReviews.length === 0 && (
              <HandNote className="py-4">Ninguém que você segue escreveu sobre este título ainda.</HandNote>
            )}
            {shownReviews.map((r) => (
              // Como as resenhas do Letterboxd: a foto à esquerda, "Resenha de" com o nome e a nota, o texto e a conversa
              <article key={r.id} className="flex gap-4 py-5">
                {r.user_id ? (
                  <Link to={`/pessoas/${r.user_id}`} aria-label={`Perfil de ${r.user_name}`} className="shrink-0">
                    <Avatar name={r.user_name} userId={r.user_id} size="h-10 w-10" />
                  </Link>
                ) : (
                  <Avatar name={r.user_name} size="h-10 w-10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                    <span>
                      Resenha de{" "}
                      {r.user_id ? (
                        <Link to={`/pessoas/${r.user_id}`} className="font-bold text-cream hover:text-accent">
                          {r.user_name}
                        </Link>
                      ) : (
                        <strong className="text-cream">{r.user_name}</strong>
                      )}
                    </span>
                    {r.rating != null && <StarsDisplay value={r.rating} size={14} />}
                    <span>{r.consumed_at ? formatDate(r.consumed_at) : timeAgo(r.created_at)}</span>
                  </p>
                  <SpoilerText text={r.review} spoiler={r.spoiler} className="mt-2 leading-relaxed text-stone-200" />
                  <ReviewTalk entry={r} />
                </div>
              </article>
            ))}
          </div>
          </section>
  );

  const backdrop = media.backdrop_url && media.backdrop_url !== brokenBackdrop ? media.backdrop_url : null;

  return (
    <div>
      <SeenStamp id={stamp} album={media.type === "album"} />
      <div className="relative overflow-hidden rounded-2xl border border-line/60 bg-surface/40 p-6 md:p-8">
        {/* Como no Letterboxd: a cena larga do título no topo, sumindo no fundo; sem ela, o pôster desfocado */}
        {backdrop ? (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-72 [mask-image:linear-gradient(to_bottom,black_35%,transparent)] sm:h-[26rem]"
          >
            <img src={backdrop} alt="" onError={() => setBrokenBackdrop(backdrop)} className="h-full w-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-bg/30" />
          </div>
        ) : (
          media.poster_url && (
            <div
              aria-hidden
              className="absolute inset-0 scale-110 bg-cover bg-center opacity-20 blur-2xl"
              style={{ backgroundImage: `url(${media.poster_url})` }}
            />
          )
        )}
        <div className={`relative grid gap-8 md:grid-cols-[240px_1fr] ${backdrop ? "pt-40 sm:pt-56" : ""}`}>
          <div className="group mx-auto w-48 md:w-full">
            {/* O que a pessoa viu vira polaroide; o que ela quer ver fica preso com fita */}
            {status.diary_entry_id ? (
              <Polaroid position={1} tape caption={statusCaption(status, album)} album={album}>
                <Poster media={media} rounded="rounded-[2px]" />
              </Polaroid>
            ) : status.in_watchlist ? (
              <div className="relative">
                <span aria-hidden className="tape -top-2 left-1/2 z-10 -translate-x-1/2 -rotate-3" style={{ background: TAPE_COLORS[0] }} />
                <Poster media={media} />
              </div>
            ) : (
              <Poster media={media} />
            )}
          </div>
          <div>
            <p className="text-sm text-muted">
              <span className="font-bold" style={{ color: MEDIA_STYLE[media.type].color }}>
                {MEDIA_STYLE[media.type].label}
              </span>
              {media.year ? ` de ${media.year}` : ""}
            </p>
            <h1 className="mt-1 text-4xl font-extrabold">{media.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {media.genres.map((g) => {
                const color = colorFor(g);
                return (
                  <Link
                    key={g}
                    to={`/buscar?genero=${encodeURIComponent(g)}`}
                    className="chip transition hover:brightness-125"
                    style={{ color, borderColor: `${color}66`, backgroundColor: `${color}14` }}
                  >
                    {g}
                  </Link>
                );
              })}
            </div>
            <p className={`mt-5 max-w-6xl leading-relaxed text-stone-300 ${fullOverview ? "" : "max-sm:line-clamp-4"}`}>
              {media.overview}
            </p>
            {!fullOverview && media.overview.length > 220 && (
              <button className="mt-1 text-sm font-semibold text-accent underline sm:hidden" onClick={() => setFullOverview(true)}>
                Ler a sinopse inteira
              </button>
            )}

            <dl className="mt-5 max-w-6xl space-y-1.5 text-sm">
              {media.creators.length > 0 && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">{media.type === "movie" ? "Direção" : media.type === "album" ? "Artista" : "Criação"}</dt>
                  <PeopleLinks names={media.creators} />
                </div>
              )}
              {media.duration_min ? (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">Duração</dt>
                  <dd>
                    {media.type === "series" && "Episódios de "}
                    {media.duration_min >= 60 ? `${Math.floor(media.duration_min / 60)} h ${media.duration_min % 60} min` : `${media.duration_min} min`}
                  </dd>
                </div>
              ) : null}
              {media.moods && media.moods.length > 0 && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">Clima</dt>
                  <dd className="flex flex-wrap gap-x-2">
                    {media.moods.map((key, i) => (
                      <span key={key}>
                        <Link to={`/buscar?clima=${key}`} className="underline decoration-dotted underline-offset-2 hover:text-accent">
                          {moodLabel(moods, key)}
                        </Link>
                        {i < media.moods!.length - 1 && ","}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {media.actors.length > 0 && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">Elenco</dt>
                  <PeopleLinks names={media.actors} />
                </div>
              )}
            </dl>

            <RatingsPanel media={media} />

            <div className="mt-6 flex flex-wrap gap-2">
              {/* Ícone cheio e borda colorida quando a ação já está feita, como no Letterboxd; o texto diz o que o clique faz */}
              <button
                className={status.diary_entry_id && status.status !== "watching" ? "btn-ghost border-accent text-accent" : "btn-primary"}
                onClick={() => setShowSeen(true)}
              >
                <ActionIcon kind="seen" on={!!status.diary_entry_id && status.status !== "watching"} />
                {status.status === "watching" ? "Terminei" : status.diary_entry_id ? "Editar registro" : words.seen}
              </button>
              {media.type === "series" && !status.diary_entry_id && (
                <button className="btn-ghost" onClick={() => startWatching(media.seasons[0]?.number ?? null)}>
                  <ActionIcon kind="watching" />
                  Estou assistindo
                </button>
              )}
              {watchlist && status.status !== "watching" && (
                <button
                  className={status.in_watchlist ? "btn-ghost border-coral text-coral" : "btn-want"}
                  onClick={() => toggleList(watchlist, status.in_watchlist)}
                >
                  <ActionIcon kind="want" on={status.in_watchlist} />
                  {status.in_watchlist ? "Tirar do Quero ver" : words.want}
                </button>
              )}
              <TrailerButton media={media} />
              <ShareButton media={media} />
              {!status.diary_entry_id && !status.in_watchlist && (
                <button className="btn-skip" onClick={toggleDismiss}>
                  {status.dismissed ? (
                    "Voltar para as sugestões"
                  ) : (
                    <>
                      <ActionIcon kind="skip" />
                      Não me interesso
                    </>
                  )}
                </button>
              )}
            </div>
            {status.dismissed && (
              <p className="mt-3 text-sm text-muted">Combinado, não vamos mais sugerir este título.</p>
            )}
            {status.status === "watching" && status.diary_entry_id ? (
              <WatchingSeason
                mediaId={media.id}
                entryId={status.diary_entry_id}
                season={status.season}
                seasons={media.seasons}
                counts={status.episodes ?? {}}
                onChange={load}
              />
            ) : (
              status.diary_entry_id && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                  {status.consumed_at ? `${words.seenOn} ${formatDate(status.consumed_at)}` : words.seenAlready}
                  {status.season != null && media.type === "series" && ` · até a temporada ${status.season}`}
                  {status.rating != null && <StarsDisplay value={status.rating} />}
                </p>
              )
            )}

            {album && <ListenLinks media={media} />}
            {!album && providers.length > 0 && <WatchProviders providers={providers} />}

            {customLists.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold">Suas listas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customLists.map((l) => {
                    const inList = status.list_ids.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        className={`chip cursor-pointer ${inList ? "border-accent text-accent" : ""}`}
                        onClick={() => toggleList(l, inList)}
                      >
                        {inList ? "✓ " : "+ "}
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* As partes da página em abas, como no Letterboxd: o topo continua com o essencial, e o resto não vira uma
          rolagem sem fim. A aba aberta fica no endereço (?aba=...), para dar para mandar o link */}
      <div role="tablist" aria-label={`Sobre ${media.title}`} className="mt-10 flex gap-6 overflow-x-auto border-b border-line/60">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            id={`aba-${key}`}
            aria-selected={tab === key}
            aria-controls="painel-do-titulo"
            onClick={() => setParams(key === tabs[0][0] ? {} : { aba: key }, { replace: true })}
            className={`-mb-px shrink-0 cursor-pointer border-b-2 px-1 pb-3 text-sm font-semibold transition ${
              tab === key ? "border-accent text-accent" : "border-transparent text-stone-300 hover:text-cream"
            }`}
          >
            {label}
            {count != null && count > 0 && <span className="ml-1.5 text-xs font-normal text-muted">{count}</span>}
          </button>
        ))}
      </div>
      {/* Dentro das abas, o título de cada parte fica só para o leitor de tela: a aba já diz o que é */}
      <div id="painel-do-titulo" role="tabpanel" aria-labelledby={`aba-${tab}`} className="mt-6 [&_h2]:sr-only [&>section]:mt-0">
        {tab === "faixas" && <Tracks album={media} />}
        {tab === "episodios" && (
          <Episodes
            mediaId={media.id}
            seasons={media.seasons}
            counts={status.episodes ?? {}}
            onChange={() => {
              diaryChanged();
              load();
            }}
          />
        )}
        {tab === "ligados" && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold">{album ? "Para ver depois" : "Para ouvir depois"}</h2>
            <p className="mt-1 text-sm text-muted">
              {album
                ? "Filmes e séries ligados a este álbum."
                : media.type === "series"
                  ? "Álbuns ligados a esta série: a trilha, quem compôs e quem do elenco também canta."
                  : "Álbuns ligados a este filme: a trilha, quem compôs, quem do elenco canta e a música de quem ele conta a história."}
              {sameReason && ` Todos por um motivo: ${connections[0].reason}.`}
            </p>
            <div className="mt-4">
              <Carousel label={album ? "para ver depois" : "para ouvir depois"}>
                {connections.map((c) => (
                  <div key={c.media.id} className="w-36 shrink-0 snap-start sm:w-40">
                    <MediaCard media={c.media}>
                      {!sameReason && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted" title={c.reason}>
                          {c.reason}
                        </p>
                      )}
                    </MediaCard>
                  </div>
                ))}
              </Carousel>
            </div>
          </section>
        )}
        {tab === "parecidos" && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold">{album ? "Álbuns parecidos" : "Títulos parecidos"}</h2>
            <div className="mt-4">
              <Carousel label="títulos parecidos">
                {similar.map((m) => (
                  <div key={m.id} className="w-36 shrink-0 snap-start sm:w-40">
                    <MediaCard media={m} />
                  </div>
                ))}
              </Carousel>
            </div>
          </section>
        )}
        {tab === "resenhas" && reviewsSection()}
      </div>

      {/* De onde vêm os dados e com que licença (RNFF02) */}
      {media.credit && (
        <p className="mt-10 max-w-4xl text-xs text-muted">
          Fonte:{" "}
          {media.credit.url ? (
            <a href={media.credit.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
              {media.credit.name}
            </a>
          ) : (
            media.credit.name
          )}
          . {media.credit.license}
        </p>
      )}

      {seenModal}
    </div>
  );
}
