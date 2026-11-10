import { useState } from "react";
import { isUpcoming } from "../format";
import type { Media } from "../types";

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pôster gerado a partir do título (o catálogo é mockado e não tem imagens). */
export default function Poster({
  media,
  className = "",
  compact = false,
  rounded = "rounded-lg",
}: {
  media: Media;
  className?: string;
  compact?: boolean;
  rounded?: string;
}) {
  const [broken, setBroken] = useState(false);
  const upcoming = !compact && isUpcoming(media.year) && (
    <span className="absolute top-2 left-2 z-10 rounded-md bg-amber px-1.5 py-0.5 text-[11px] font-bold text-bg">
      Em breve
    </span>
  );
  if (media.poster_url && !broken) {
    return (
      <div className="relative">
        <img
          src={media.poster_url}
          alt={media.title}
          loading="lazy"
          onError={() => setBroken(true)}
          className={`aspect-[2/3] w-full ${rounded} object-cover ${className}`}
        />
        {upcoming}
      </div>
    );
  }
  const h = hash(media.title);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 80)) % 360;
  return (
    <div
      className={`relative flex aspect-[2/3] w-full flex-col justify-end overflow-hidden ${rounded} p-3 ${className}`}
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 55% 32%), hsl(${hue2} 60% 14%) 70%, #0b0d10)`,
      }}
      aria-label={`Pôster de ${media.title}`}
    >
      {upcoming}
      {compact ? (
        <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white/70">
          {media.title.charAt(0)}
        </span>
      ) : (
        <>
      <span className="absolute top-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/80 uppercase">
        {media.type === "movie" ? "Filme" : "Série"}
      </span>
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
