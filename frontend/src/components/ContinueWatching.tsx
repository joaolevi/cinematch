import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { episodePath } from "../pages/EpisodePage";
import { useDiaryVersion } from "../seen";
import type { Watching } from "../types";
import Carousel from "./Carousel";

/**
 * Continuar assistindo, como na Netflix e na HBO: as séries em andamento, com a cena da série, a barra da temporada
 * e o próximo episódio, que abre a página dele.
 */
export default function ContinueWatching() {
  const [items, setItems] = useState<Watching[]>([]);
  const version = useDiaryVersion();
  useEffect(() => {
    api.continueWatching().then(setItems).catch(() => {});
  }, [version]);
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 font-display text-2xl font-bold">
        Continuar assistindo
        <span className="block font-hand text-xl font-bold text-accent sm:ml-3 sm:inline">de onde você parou</span>
      </h2>
      <Carousel label="continuar assistindo">
        {items.map((w) => {
          const image = w.media.backdrop_url ?? w.media.poster_url;
          const to = w.next_episode ? episodePath(w.media.id, w.season, w.next_episode) : `/media/${w.media.id}`;
          const progress = w.total ? Math.min(100, (w.seen / w.total) * 100) : 0;
          return (
            <Link key={w.media.id} to={to} className="group w-72 shrink-0 snap-start sm:w-80">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-line/60 bg-surface">
                {image && <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <span aria-hidden className="absolute top-1/2 left-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-cream opacity-0 transition group-hover:opacity-100">
                  ▶
                </span>
                <p className="absolute bottom-3 left-3 font-display text-lg leading-tight font-bold text-cream">{w.media.title}</p>
                {w.total != null && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden>
                    <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm">
                <span className="font-semibold">Temporada {w.season}</span>
                <span className="text-muted">
                  {w.next_episode ? ` · próximo: episódio ${w.next_episode}` : " · temporada completa"}
                  {w.total != null && ` · ${w.seen} de ${w.total}`}
                </span>
              </p>
            </Link>
          );
        })}
      </Carousel>
    </section>
  );
}
