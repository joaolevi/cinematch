import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { episodePath } from "../pages/EpisodePage";
import { trackPath } from "../pages/TrackPage";
import { useDiaryVersion } from "../seen";
import type { Listening, Media, Watching } from "../types";
import Carousel from "./Carousel";

/** Um cartão da fileira: a imagem larga, o título, a barra de progresso e a linha de baixo. */
function Card({ to, media, wide, progress, line }: { to: string; media: Media; wide: string | null; progress: number | null; line: React.ReactNode }) {
  const album = media.type === "album";
  return (
    <Link to={to} className="group w-72 shrink-0 snap-start sm:w-80">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-line/60 bg-surface">
        {album && media.poster_url ? (
          // O disco não tem cena larga: a capa desfocada vira o fundo, e a capa nítida fica à direita
          <>
            <img src={media.poster_url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-xl" />
            <img src={media.poster_url} alt="" loading="lazy" className="absolute top-3 right-3 aspect-square h-[calc(100%-1.5rem)] w-auto rounded-md object-cover shadow-xl transition group-hover:scale-[1.03]" />
          </>
        ) : (
          wide && <img src={wide} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <span aria-hidden className="absolute top-3 left-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold tracking-wide text-cream uppercase">
          {album ? "Ouvindo" : "Assistindo"}
        </span>
        <p className={`absolute bottom-3 left-3 font-display text-lg leading-tight font-bold text-cream ${album ? "right-[45%]" : "right-3"}`}>
          {media.title}
        </p>
        {progress != null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden>
            <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-sm">{line}</p>
    </Link>
  );
}

type Item = { at: string; key: string; node: React.ReactNode };

/**
 * Continuar assistindo e ouvindo, como na Netflix e no Spotify: as séries em andamento, com o próximo episódio, e os
 * discos com faixas ouvidas, com a próxima faixa. Juntos, do que a pessoa mexeu por último para o mais antigo.
 */
export default function ContinueWatching() {
  const [watching, setWatching] = useState<Watching[]>([]);
  const [listening, setListening] = useState<Listening[]>([]);
  const version = useDiaryVersion();
  useEffect(() => {
    api.continueWatching().then(setWatching).catch(() => {});
    api.continueListening().then(setListening).catch(() => {});
  }, [version]);

  const items: Item[] = [
    ...watching.map((w) => ({
      at: w.moved_at ?? "",
      key: `s${w.media.id}`,
      node: (
        <Card
          key={`s${w.media.id}`}
          to={w.next_episode ? episodePath(w.media.id, w.season, w.next_episode) : `/media/${w.media.id}`}
          media={w.media}
          wide={w.media.backdrop_url ?? w.media.poster_url}
          progress={w.total ? Math.min(100, (w.seen / w.total) * 100) : null}
          line={
            <>
              <span className="font-semibold">Temporada {w.season}</span>
              <span className="text-muted">
                {w.next_episode ? ` · próximo: episódio ${w.next_episode}` : " · temporada completa"}
                {w.total != null && ` · ${w.seen} de ${w.total}`}
              </span>
            </>
          }
        />
      ),
    })),
    ...listening.map((l) => ({
      at: l.moved_at,
      key: `a${l.media.id}`,
      node: (
        <Card
          key={`a${l.media.id}`}
          to={l.next_track ? trackPath(l.media.id, l.next_track.disc, l.next_track.number) : `/media/${l.media.id}`}
          media={l.media}
          wide={null}
          progress={l.total ? Math.min(100, (l.heard / l.total) * 100) : null}
          line={
            <>
              <span className="font-semibold">
                {l.heard} {l.total ? `de ${l.total} faixas` : l.heard === 1 ? "faixa ouvida" : "faixas ouvidas"}
              </span>
              {l.next_track && <span className="text-muted"> · próxima: {l.next_track.title}</span>}
            </>
          }
        />
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (items.length === 0) return null;
  const both = watching.length > 0 && listening.length > 0;
  const title = both ? "Continuar assistindo e ouvindo" : listening.length ? "Continuar ouvindo" : "Continuar assistindo";
  return (
    <section>
      <h2 className="mb-4 font-display text-2xl font-bold">
        {title}
        <span className="block font-hand text-xl font-bold text-accent sm:ml-3 sm:inline">de onde você parou</span>
      </h2>
      <Carousel label={title.toLowerCase()}>{items.map((i) => i.node)}</Carousel>
    </section>
  );
}
