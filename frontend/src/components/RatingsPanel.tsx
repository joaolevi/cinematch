import { Link } from "react-router-dom";
import { formatRating, plural } from "../format";
import type { MediaDetail } from "../types";
import { StarsDisplay } from "./Stars";
import { Avatar } from "./WatchedBy";

const LABELS = ["0,5", "1", "1,5", "2", "2,5", "3", "3,5", "4", "4,5", "5"];

/**
 * As notas do título, como no Letterboxd: a média, a distribuição em 10 colunas, de 0,5 a 5, e quem você segue que
 * registrou o título, com a nota de cada pessoa.
 */
export default function RatingsPanel({ media }: { media: MediaDetail }) {
  const max = Math.max(...media.histogram, 1);
  const total = media.histogram.reduce((a, b) => a + b, 0);
  return (
    <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
      <div>
        <div className="flex items-center gap-3 text-sm">
          {media.avg_rating != null && <StarsDisplay value={media.avg_rating} />}
          <span className="text-muted">
            {media.avg_rating != null
              ? `${formatRating(media.avg_rating)} de média em ${plural(media.ratings_count, "nota", "notas")}`
              : "Ainda sem notas"}
          </span>
        </div>
        {total > 1 && (
          <div
            role="img"
            aria-label={`Distribuição das notas: ${media.histogram.map((n, i) => `${n} com ${LABELS[i]}`).filter((_, i) => media.histogram[i]).join(", ")}`}
            className="mt-2 flex h-10 w-56 items-end gap-[3px] border-b border-line"
          >
            {media.histogram.map((n, i) => (
              <span
                key={LABELS[i]}
                title={`${plural(n, "nota", "notas")} ${LABELS[i]}`}
                className="flex-1 rounded-t-sm bg-stone-500/70"
                style={{ height: `${Math.max((n / max) * 100, n ? 8 : 2)}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {media.friends.length > 0 && (
        <div>
          <p className="text-xs font-bold tracking-wide text-muted uppercase">De quem você segue</p>
          <ul className="mt-2 flex flex-wrap gap-3">
            {media.friends.map((f) => (
              <li key={f.id}>
                <Link to={`/pessoas/${f.id}`} className="flex flex-col items-center gap-1 text-xs hover:text-accent" title={f.name}>
                  <Avatar name={f.name} userId={f.id} size="h-9 w-9 text-sm" />
                  {f.rating != null ? (
                    <StarsDisplay value={f.rating} size={10} />
                  ) : (
                    <span className="text-muted">{f.status === "watching" ? "assistindo" : "viu"}</span>
                  )}
                  <span className="sr-only">
                    {f.name}
                    {f.rating != null ? `, nota ${formatRating(f.rating)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
