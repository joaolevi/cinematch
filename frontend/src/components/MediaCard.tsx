import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Media } from "../types";
import Poster from "./Poster";

export default function MediaCard({
  media,
  children,
  subtitle,
}: {
  media: Media;
  children?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="group flex flex-col">
      <Link to={`/media/${media.id}`} className="block transition group-hover:-translate-y-0.5">
        <Poster media={media} />
      </Link>
      <Link to={`/media/${media.id}`} className="mt-2 line-clamp-1 text-sm font-semibold hover:text-accent">
        {media.title}
      </Link>
      <p className="line-clamp-1 text-xs text-muted">
        {subtitle ?? [media.year, media.genres.slice(0, 2).join(" · ")].filter(Boolean).join(" · ")}
      </p>
      {children}
    </div>
  );
}
