import { useState } from "react";
import { MEDIA_STYLE, isUpcoming } from "../format";
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
  if (media.type === "album") {
    // A capa é quadrada e o espaço é vertical: o disco de vinil sai por baixo da capa e ocupa a sobra
    const cover = media.poster_url && !broken ? media.poster_url : null;
    const h = hash(media.title);
    return (
      <div className={`relative aspect-[2/3] w-full ${className}`}>
        <div
          aria-hidden
          className="absolute top-[37%] left-[6%] aspect-square w-[88%] rounded-full shadow-[0_6px_18px_rgba(0,0,0,.45),0_0_0_1.5px_rgba(255,255,255,.28)]"
          style={{ background: "repeating-radial-gradient(circle at center, #2c2c2e 0 1.5px, #3d3d40 1.5px 3px)" }}
        >
          {/* Brilho do vinil: duas faixas de luz em cruz, como um disco sob a lâmpada */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 30deg, transparent 0 8%, rgba(255,255,255,.28) 12%, transparent 18% 50%, rgba(255,255,255,.22) 62%, transparent 68%)",
            }}
          />
          <div
            className="absolute inset-[31%] rounded-full bg-cover bg-center ring-2 ring-black/50"
            style={cover ? { backgroundImage: `url(${cover})` } : { background: `hsl(${h % 360} 45% 45%)` }}
          />
          <div className="absolute inset-[48.5%] rounded-full bg-[#0b0d10]" />
        </div>
        {cover ? (
          <img
            src={cover}
            alt={media.title}
            loading="lazy"
            onError={() => setBroken(true)}
            className={`absolute inset-x-0 top-0 aspect-square w-full object-cover shadow-[0_8px_20px_rgba(0,0,0,.55)] ${rounded}`}
            style={{ background: `linear-gradient(160deg, hsl(${h % 360} 40% 28%), #1a1512)` }}
          />
        ) : (
          <div
            className={`absolute inset-x-0 top-0 flex aspect-square w-full flex-col justify-end p-3 shadow-[0_8px_20px_rgba(0,0,0,.55)] ${rounded}`}
            style={{ background: `linear-gradient(160deg, hsl(${h % 360} 55% 32%), #0b0d10)` }}
            aria-label={`Capa de ${media.title}`}
          >
            {!compact && <p className="line-clamp-3 text-sm leading-tight font-bold text-white drop-shadow">{media.title}</p>}
          </div>
        )}
        {upcoming}
      </div>
    );
  }
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
        {MEDIA_STYLE[media.type].label}
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
