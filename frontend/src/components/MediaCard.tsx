import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Media } from "../api/types";
import GenreChip from "./GenreChip";
import Poster from "./Poster";

export default function MediaCard({
  media,
  children,
  subtitle,
  note,
}: {
  media: Media;
  children?: ReactNode;
  subtitle?: ReactNode;
  note?: string;
}) {
  const to = `/titulo/${media.id}`;
  return (
    <div className="group flex flex-col">
      <Link to={to} className="block transition group-hover:-translate-y-0.5">
        <Poster media={media} />
      </Link>
      <Link to={to} className="mt-2 line-clamp-1 text-sm font-semibold hover:text-accent">
        {media.title}
      </Link>
      {subtitle ? (
        <p className="line-clamp-1 text-xs text-muted">{subtitle}</p>
      ) : (
        <>
          {media.year && <p className="text-xs text-muted">{media.year}</p>}
          {media.genres.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {media.genres.slice(0, 2).map((g) => (
                <GenreChip key={g} genre={g} />
              ))}
            </div>
          )}
        </>
      )}
      {note && <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">{note}</p>}
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
