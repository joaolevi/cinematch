import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { MEDIA_STYLE } from "../format";
import { useSeen } from "../seen";
import { StarsDisplay } from "./Stars";
import type { Media } from "../types";
import Polaroid from "./Polaroid";
import Poster from "./Poster";

export default function MediaCard({
  media,
  children,
  subtitle,
  sticker,
  overlay,
  polaroid,
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
  /** Só título, tipo e ano: para fileiras, onde os gêneros quebrariam em várias linhas */
  compact?: boolean;
}) {
  const { user } = useAuth();
  const mine = useSeen(user?.id)?.get(media.id);
  const poster = (
    <Link to={`/media/${media.id}`} className="relative block" aria-label={media.title}>
      <Poster media={media} rounded={polaroid ? "rounded-[2px]" : "rounded-lg"} />
      {/* Como no Letterboxd: o pôster fica limpo, e o tipo, o ano e a sua nota aparecem ao passar o mouse ou focar */}
      {!polaroid && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 rounded-b-lg bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 pt-10 pb-2 text-xs opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <span>
            <span className="font-bold" style={{ color: MEDIA_STYLE[media.type].color }}>
              {MEDIA_STYLE[media.type].label}
            </span>
            {media.year && <span className="text-stone-300"> · {media.year}</span>}
          </span>
          {mine &&
            (mine.status === "watching" ? (
              <span className="font-semibold text-accent">Assistindo{mine.season ? ` · T${mine.season}` : ""}</span>
            ) : mine.rating != null ? (
              <StarsDisplay value={mine.rating} size={12} />
            ) : (
              <span className="font-semibold text-accent">Visto</span>
            ))}
        </span>
      )}
    </Link>
  );
  return (
    <div className="group relative flex flex-1 flex-col">
      <div className="relative transition group-hover:-translate-y-0.5">
        {polaroid ? (
          <Polaroid position={polaroid.position} caption={polaroid.caption} album={media.type === "album"}>
            {poster}
          </Polaroid>
        ) : (
          poster
        )}
        {sticker && <span className={`sticker ${overlay ? "sticker-left" : ""}`}>{sticker}</span>}
        {overlay}
      </div>
      <Link to={`/media/${media.id}`} className="mt-2.5 line-clamp-1 text-sm font-semibold hover:text-accent">
        {compact && !subtitle && (
          <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: MEDIA_STYLE[media.type].color }} />
        )}
        {media.title}
      </Link>
      {subtitle ? (
        <p className="line-clamp-1 text-xs text-muted">{subtitle}</p>
      ) : compact ? (
        // Nas fileiras, só o título fica embaixo; o tipo vira um ponto colorido e o resto aparece sobre o pôster
        <span className="sr-only">
          {MEDIA_STYLE[media.type].label}
          {media.year ? `, ${media.year}` : ""}
        </span>
      ) : (
        <p className="flex gap-2 text-xs">
          <span className="font-bold" style={{ color: MEDIA_STYLE[media.type].color }}>
            {MEDIA_STYLE[media.type].label}
          </span>
          {media.year && <span className="text-muted">{media.year}</span>}
        </p>
      )}
      {children}
    </div>
  );
}
