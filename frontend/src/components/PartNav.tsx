import { Link } from "react-router-dom";
import { formatRating, plural } from "../format";
import { StarsDisplay } from "./Stars";

/** O que todo mundo achou de um episódio ou de uma faixa: a média e quantas pessoas marcaram. As anotações não entram. */
export function Everyone({ average, ratings, seenBy, album }: { average: number | null; ratings: number; seenBy: number; album: boolean }) {
  return (
    <section className="mt-8" aria-label="O que todo mundo achou">
      <h2 className="font-display text-lg font-bold">O que todo mundo achou</h2>
      {seenBy === 0 ? (
        <p className="mt-1 text-sm text-muted">Ninguém marcou ainda. Que tal ser a primeira pessoa?</p>
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {average != null && (
            <>
              <StarsDisplay value={average} size={18} />
              <span>
                <strong className="text-cream">{formatRating(average)}</strong> de média em {plural(ratings, "nota", "notas")}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{plural(seenBy, album ? "pessoa ouviu" : "pessoa viu", album ? "pessoas ouviram" : "pessoas viram")}</span>
        </p>
      )}
    </section>
  );
}

/** Anterior e próximo, como as setas de um player. */
export function PartNav({
  previous,
  next,
}: {
  previous: { to: string; label: string; title: string | null } | null;
  next: { to: string; label: string; title: string | null } | null;
}) {
  if (!previous && !next) return null;
  const card = "card flex min-w-0 flex-1 flex-col gap-0.5 p-4 transition hover:border-accent";
  return (
    <nav aria-label="Anterior e próximo" className="mt-10 flex flex-col gap-3 sm:flex-row">
      {previous ? (
        <Link to={previous.to} className={card}>
          <span className="text-xs font-semibold text-muted">← {previous.label}</span>
          {previous.title && <span className="truncate font-semibold">{previous.title}</span>}
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link to={next.to} className={`${card} sm:items-end sm:text-right`}>
          <span className="text-xs font-semibold text-muted">{next.label} →</span>
          {next.title && <span className="max-w-full truncate font-semibold">{next.title}</span>}
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}
