import { Link } from "react-router-dom";
import { formatRating, plural } from "../format";
import type { Top } from "../types";
import Poster from "./Poster";

/**
 * O Top 10 do Tastory, com os números grandes ao lado do pôster, como o Top 10 da Netflix. A lista sai dos registros
 * da comunidade, e não da popularidade de fora.
 */
export default function TopTen({ top }: { top: Top }) {
  return (
    <ol className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {top.items.map((item, i) => (
        <li key={item.media.id} className="shrink-0 snap-start">
          <Link
            to={`/media/${item.media.id}`}
            className="group flex items-end"
            aria-label={`${i + 1}º lugar: ${item.media.title}, ${plural(item.count, "registro", "registros")}${
              item.average != null ? `, nota média ${formatRating(item.average)}` : ""
            }`}
          >
            <span
              aria-hidden
              className="-mr-4 font-display text-[7rem] leading-[0.8] font-bold text-transparent [-webkit-text-stroke:3px_var(--color-accent)] sm:text-[8.5rem]"
            >
              {i + 1}
            </span>
            <span className="relative z-[1] w-28 transition group-hover:-translate-y-1 sm:w-32">
              <Poster media={item.media} compact rounded="rounded-lg" />
            </span>
          </Link>
          <p className="mt-2 pl-12 text-xs text-muted">
            {plural(item.count, "registro", "registros")}
            {item.average != null && ` · ★ ${formatRating(item.average)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
