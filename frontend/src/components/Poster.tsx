import { useState } from "react";
import type { Media } from "../api/types";
import { titleHues } from "../lib/visual";

type PosterMedia = Pick<Media, "title" | "poster_url"> & Partial<Pick<Media, "type" | "year">>;

/** Pôster do catálogo; sem imagem (ou se quebrar), gera um a partir do título. */
export default function Poster({
  media,
  className = "",
  compact = false,
}: {
  media: PosterMedia;
  className?: string;
  compact?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  if (media.poster_url && !broken) {
    return (
      <img
        src={media.poster_url}
        alt={media.title}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`aspect-[2/3] w-full rounded-lg object-cover ${className}`}
      />
    );
  }
  const [hue, hue2] = titleHues(media.title);
  return (
    <div
      className={`relative flex aspect-[2/3] w-full flex-col justify-end overflow-hidden rounded-lg p-3 ${className}`}
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 55% 32%), hsl(${hue2} 60% 14%) 70%, #0b0d10)`,
      }}
      aria-label={`Pôster de ${media.title}`}
    >
      {compact ? (
        <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white/70">
          {media.title.charAt(0)}
        </span>
      ) : (
        <>
          {media.type && (
            <span className="absolute top-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/80">
              {media.type === "movie" ? "Filme" : "Série"}
            </span>
          )}
          <span
            className="pointer-events-none absolute -top-4 -right-3 text-[96px] leading-none font-extrabold text-white/10 select-none"
            aria-hidden
          >
            {media.title.charAt(0)}
          </span>
          <p className="line-clamp-3 text-sm leading-tight font-bold text-white drop-shadow">{media.title}</p>
          {media.year && <p className="text-xs text-white/70">{media.year}</p>}
        </>
      )}
    </div>
  );
}
