import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MEDIA_STYLE } from "../format";
import type { Media } from "../types";
import GenreChip from "./GenreChip";
import Polaroid from "./Polaroid";
import Poster from "./Poster";
import { TAPE_COLORS } from "../ui";

export default function MediaCard({
  media,
  children,
  subtitle,
  sticker,
  overlay,
  polaroid,
  pinned,
  compact = false,
}: {
  media: Media;
  children?: ReactNode;
  subtitle?: ReactNode;
  /** Selo inclinado no canto do pôster */
  sticker?: ReactNode;
  /** Botão sobre o pôster, fora do link */
  overlay?: ReactNode;
  /** Mostra o pôster como polaroide colada no diário, com a legenda escrita à mão */
  polaroid?: { caption: string; position: number };
  /** Pôster preso com fita, sem data: o que a pessoa quer ver. A polaroide fica para o que ela já viu */
  pinned?: { position: number };
  /** Só título, tipo e ano: para fileiras, onde os gêneros quebrariam em várias linhas */
  compact?: boolean;
}) {
  const poster = (
    <Link to={`/media/${media.id}`} className="block" aria-label={media.title}>
      <Poster media={media} rounded={polaroid ? "rounded-[2px]" : "rounded-lg"} />
    </Link>
  );
  return (
    <div className="group flex flex-1 flex-col">
      <div className="relative transition group-hover:-translate-y-0.5">
        {polaroid ? (
          <Polaroid position={polaroid.position} caption={polaroid.caption}>
            {poster}
          </Polaroid>
        ) : pinned ? (
          <>
            <span
              aria-hidden
              className="tape -top-2 left-1/2 -translate-x-1/2 -rotate-3"
              style={{ background: TAPE_COLORS[pinned.position % TAPE_COLORS.length] }}
            />
            {poster}
          </>
        ) : (
          poster
        )}
        {sticker && <span className={`sticker ${overlay ? "sticker-left" : ""}`}>{sticker}</span>}
        {overlay}
      </div>
      <Link to={`/media/${media.id}`} className="mt-2.5 line-clamp-1 text-sm font-semibold hover:text-accent">
        {media.title}
      </Link>
      {subtitle ? (
        <p className="line-clamp-1 text-xs text-muted">{subtitle}</p>
      ) : (
        <p className="flex gap-2 text-xs">
          <span className="font-bold" style={{ color: MEDIA_STYLE[media.type].color }}>
            {MEDIA_STYLE[media.type].label}
          </span>
          {media.year && <span className="text-muted">{media.year}</span>}
        </p>
      )}
      {!subtitle && !compact && media.genres.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {media.genres.slice(0, 2).map((g) => (
            <GenreChip key={g} genre={g} small />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
