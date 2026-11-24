import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Carousel from "../components/Carousel";
import MediaCard from "../components/MediaCard";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import SeenModal from "../components/SeenModal";
import SeenStamp from "../components/SeenStamp";
import { diaryChanged, useDiaryVersion } from "../seen";
import { StarsDisplay } from "../components/Stars";
import WatchedBy from "../components/WatchedBy";
import { colorFor, formatDate, formatRating, MEDIA_STYLE, plural, SERVICE_LABEL, verbs } from "../format";
import type { Connection, Media, MediaDetail, UserList } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";
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
  const verb = album ? "ouvi" : "vi";
  if (status.diary_entry_id && status.consumed_at) {
    const day = new Date(`${status.consumed_at}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    return `${verb} em ${day}`;
  }
  return `já ${verb}`;
}

/** Busca do álbum em cada serviço, para quando o disco não tem link próprio. */
const SEARCH_URL: Record<string, (q: string) => string> = {
  spotify: (q) => `https://open.spotify.com/search/${q}`,
  deezer: (q) => `https://www.deezer.com/search/${q}`,
  youtube_music: (q) => `https://music.youtube.com/search?q=${q}`,
  apple_music: (q) => `https://music.apple.com/br/search?term=${q}`,
};

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

/** Cada título monta a página do zero, para nada do título anterior sobrar na tela. */
export default function MediaPage() {
  const { id } = useParams();
  return <MediaView key={id} mediaId={Number(id)} />;
}

function MediaView({ mediaId }: { mediaId: number }) {
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const [lists, setLists] = useState<UserList[]>([]);
  const [similar, setSimilar] = useState<Media[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showSeen, setShowSeen] = useState(false);
  const [stamp, setStamp] = useState(0);
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
    window.scrollTo(0, 0);
  }, [mediaId]);

  usePageTitle(media?.title);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!media) return <HandNote>Abrindo o diário nesta página...</HandNote>;

  const watchlist = lists.find((l) => l.is_watchlist);
  const customLists = lists.filter((l) => !l.is_watchlist);
  const status = media.my_status;
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

  async function toggleDismiss() {
    if (status.dismissed) await api.undoDismiss(mediaId);
    else await api.feedback(mediaId, "dismiss");
    load();
  }

  return (
    <div>
      <SeenStamp id={stamp} />
      <div className="relative overflow-hidden rounded-2xl border border-line/60 bg-surface/40 p-6 md:p-8">
        {media.poster_url && (
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-20 blur-2xl"
            style={{ backgroundImage: `url(${media.poster_url})` }}
          />
        )}
        <div className="relative grid gap-8 md:grid-cols-[240px_1fr]">
          <div className="group mx-auto w-48 md:w-full">
            {/* O que a pessoa viu vira polaroide; o que ela quer ver fica preso com fita */}
            {status.diary_entry_id ? (
              <Polaroid position={1} caption={statusCaption(status, album)}>
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
            <p className="mt-5 max-w-6xl leading-relaxed text-stone-300">{media.overview}</p>

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
                  <dd>{media.duration_min >= 60 ? `${Math.floor(media.duration_min / 60)} h ${media.duration_min % 60} min` : `${media.duration_min} min`}</dd>
                </div>
              ) : null}
              {media.actors.length > 0 && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">Elenco</dt>
                  <PeopleLinks names={media.actors} />
                </div>
              )}
            </dl>

            <div className="mt-5 flex items-center gap-3 text-sm">
              {media.avg_rating != null && <StarsDisplay value={media.avg_rating} />}
              <span className="text-muted">
                {media.avg_rating != null
                  ? `${formatRating(media.avg_rating)} de média em ${plural(media.ratings_count, "nota", "notas")}`
                  : "Ainda sem notas"}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setShowSeen(true)}>
                {status.diary_entry_id ? "Editar registro" : `✓ ${words.seen}`}
              </button>
              {watchlist && (
                <button className={status.in_watchlist ? "btn-ghost" : "btn-want"} onClick={() => toggleList(watchlist, status.in_watchlist)}>
                  {status.in_watchlist ? "Remover do Quero ver" : `+ ${words.want}`}
                </button>
              )}
              {!status.diary_entry_id && !status.in_watchlist && (
                <button className="btn-skip" onClick={toggleDismiss}>
                  {status.dismissed ? "↩ Voltar para as sugestões" : "✕ Não me interesso"}
                </button>
              )}
            </div>
            {status.dismissed && (
              <p className="mt-3 text-sm text-muted">Combinado, não vamos mais sugerir este título.</p>
            )}
            {status.diary_entry_id && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                {status.consumed_at ? `${words.seenOn} ${formatDate(status.consumed_at)}` : words.seenAlready}
                {status.rating != null && <StarsDisplay value={status.rating} />}
              </p>
            )}

            {album && <ListenLinks media={media} />}

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

      {connections.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-bold">{album ? "Para ver depois" : "Para ouvir depois"}</h2>
          <p className="mt-1 text-sm text-muted">
            {album ? "Filmes e séries ligados a este álbum." : "Álbuns ligados a este título: a trilha, quem compôs e quem do elenco também canta."}
          </p>
          <div className="mt-4">
            <Carousel label={album ? "para ver depois" : "para ouvir depois"}>
              {connections.map((c) => (
                <div key={c.media.id} className="w-36 shrink-0 snap-start sm:w-40">
                  <MediaCard media={c.media}>
                    <p className="mt-1 line-clamp-2 text-xs text-muted" title={c.reason}>
                      {c.reason}
                    </p>
                  </MediaCard>
                </div>
              ))}
            </Carousel>
          </div>
        </section>
      )}

      {similar.length > 0 && (
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

      {album && (
        <p className="mt-8 text-xs text-muted">
          Dados do álbum:{" "}
          <a href="https://musicbrainz.org" target="_blank" rel="noreferrer" className="underline hover:text-accent">MusicBrainz</a>. Capa:{" "}
          <a href="https://coverartarchive.org" target="_blank" rel="noreferrer" className="underline hover:text-accent">Cover Art Archive</a>.
        </p>
      )}

      <section className="mt-12 max-w-4xl">
        <h2 className="font-display text-xl font-bold">Resenhas</h2>
        {media.reviews.length === 0 && <HandNote className="mt-2">Ninguém escreveu sobre este ainda. Que tal ser a primeira pessoa?</HandNote>}
        <div className="mt-2 divide-y divide-line/60">
          {media.reviews.map((r) => (
            <article key={r.id} className="py-4">
              <WatchedBy name={r.user_name} rating={r.rating} consumedAt={r.consumed_at} createdAt={r.created_at} />
              <p className="mt-2 break-words whitespace-pre-line text-stone-200">{r.review}</p>
            </article>
          ))}
        </div>
      </section>

      {showSeen && (
        <SeenModal
          media={media}
          initialRating={status.rating}
          initialDate={status.consumed_at}
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
          onConfirm={async (rating, review, date) => {
            if (status.diary_entry_id) {
              await api.updateDiary(status.diary_entry_id, {
                rating,
                consumed_at: date,
                ...(review ? { review } : {}),
              });
            } else {
              await api.feedback(mediaId, "seen", rating, review, date);
              setStamp(Date.now());
            }
            diaryChanged();
            setShowSeen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
