import { Link } from "react-router-dom";
import { MEDIA_STYLE } from "../format";
import type { FeedbackAction, Media, Recommendation } from "../types";
import { TAPE_COLORS } from "../ui";
import GenreChip from "./GenreChip";
import Poster from "./Poster";

export type Act = (media: Media, action: FeedbackAction) => void;

export function Buttons({
  rec,
  act,
  onSeen,
  big = false,
}: {
  rec: Recommendation;
  act: Act;
  onSeen: () => void;
  big?: boolean;
}) {
  const size = big ? "px-5" : "flex-1 px-3";
  return (
    <div className={`flex flex-wrap gap-1.5 ${big ? "mt-5 gap-2" : "mt-auto pt-2.5"}`}>
      <button className={`btn-want whitespace-nowrap ${size}`} onClick={() => act(rec.media, "want")}>
        Quero ver
      </button>
      <button className={`btn-seen whitespace-nowrap ${size}`} onClick={onSeen}>
        Já vi
      </button>
      {big && (
        <button className="btn-skip px-3" onClick={() => act(rec.media, "dismiss")}>
          Não me interesso
        </button>
      )}
    </div>
  );
}

/** "Não me interesso" nos cards menores: um X no canto do pôster, para não gastar uma linha inteira. */
export function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Não me interesso"
      title="Não me interesso"
      className="absolute top-2 right-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-bg/75 text-cream/90 shadow-md backdrop-blur-sm transition hover:bg-coral hover:text-bg"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
      </svg>
    </button>
  );
}

/** A primeira sugestão aparece grande, com o pôster desfocado ao fundo. */
export default function Highlight({
  rec,
  label,
  act,
  onSeen,
}: {
  rec: Recommendation;
  label: string;
  act: Act;
  onSeen: () => void;
}) {
  const { media } = rec;
  return (
    <section className="relative mt-6 overflow-hidden rounded-3xl border border-line bg-surface">
      {media.poster_url && (
        <img
          src={media.poster_url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/75 to-bg/10" />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <Link
          to={`/media/${media.id}`}
          className="relative w-32 shrink-0 -rotate-2 shadow-2xl transition hover:rotate-0 sm:w-44"
        >
          <span
            aria-hidden
            className="tape -top-2 left-1/2 -translate-x-1/2 rotate-2"
            style={{ background: TAPE_COLORS[0] }}
          />
          <Poster media={media} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-hand text-2xl leading-none font-bold text-accent">{label}</p>
          <Link to={`/media/${media.id}`} className="hover:text-accent">
            <h2 className="mt-1 font-display text-3xl leading-tight font-bold sm:text-4xl">{media.title}</h2>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold" style={{ color: MEDIA_STYLE[media.type].color }}>
              {MEDIA_STYLE[media.type].label}
            </span>
            {media.year && <span className="text-muted">{media.year}</span>}
            {media.genres.map((g) => (
              <GenreChip key={g} genre={g} small />
            ))}
          </div>
          <p className="mt-3 max-w-2xl font-semibold text-stone-100">{rec.reason}</p>
          {media.overview && <p className="mt-2 line-clamp-3 max-w-2xl text-sm text-stone-300">{media.overview}</p>}
          <Buttons rec={rec} act={act} onSeen={onSeen} big />
        </div>
      </div>
    </section>
  );
}

/** Ver Recomendações: feed com Quero ver / Já vi / Não me interesso. */
