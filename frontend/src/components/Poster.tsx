import { useState } from "react";
import { MEDIA_STYLE, isUpcoming } from "../format";
import type { Media } from "../types";

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Sem imagem, ou enquanto ela carrega: uma ficha de papel pautado, como o resto do Tastory
const PAPER = {
  background: "repeating-linear-gradient(180deg, #f1e6d6 0, #f1e6d6 15px, #d6d3cd 15px, #d6d3cd 16px)",
};

/** A ficha de papel com o título, o tipo e, no álbum, o artista. */
function PaperCard({ media, compact }: { media: Media; compact: boolean }) {
  if (compact) {
    return (
      <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-[#2b211c]/70">
        {media.title.charAt(0)}
      </span>
    );
  }
  return (
    <>
      <span aria-hidden className="absolute inset-y-0 left-4 w-px bg-[#e8735a]/60" />
      <span className="relative font-hand text-lg leading-none font-bold text-[#b9452f]">{MEDIA_STYLE[media.type].label}</span>
      <p className="relative mt-1 line-clamp-4 font-display text-base leading-tight font-bold text-[#2b211c]">{media.title}</p>
      <p className="relative mt-1 line-clamp-1 text-xs text-stone-600">
        {media.type === "album" ? media.creators[0] ?? media.year : media.year}
      </p>
    </>
  );
}

/** Pôster ou capa do título; sem imagem, uma ficha de papel com o nome. */
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
  const [loaded, setLoaded] = useState(false); // a capa do álbum vem do Cover Art Archive e pode levar segundos
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
        {/* A ficha fica por baixo da capa: aparece sem capa e enquanto ela carrega */}
        <div
          className={`absolute inset-x-0 top-0 flex aspect-square w-full flex-col justify-end overflow-hidden p-3 pl-7 shadow-[0_8px_20px_rgba(0,0,0,.55)] ${rounded}`}
          style={PAPER}
          aria-label={cover ? undefined : `Capa de ${media.title}`}
          aria-hidden={cover ? true : undefined}
        >
          <PaperCard media={media} compact={compact} />
        </div>
        {cover && (
          <img
            src={cover}
            alt={media.title}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
            className={`absolute inset-x-0 top-0 aspect-square w-full object-cover shadow-[0_8px_20px_rgba(0,0,0,.55)] transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${rounded}`}
          />
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
  return (
    <div
      className={`relative flex aspect-[2/3] w-full flex-col justify-end overflow-hidden ${rounded} p-3 pl-7 ${className}`}
      style={PAPER}
      aria-label={`Pôster de ${media.title}`}
    >
      {upcoming}
      <PaperCard media={media} compact={compact} />
    </div>
  );
}
