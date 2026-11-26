import { Link } from "react-router-dom";
import { formatDate, localDate, timeAgo } from "../format";
import type { CommunityEntry } from "../types";
import Poster from "./Poster";
import ReviewTalk from "./ReviewTalk";
import SpoilerText from "./SpoilerText";
import { StarsDisplay } from "./Stars";
import { Avatar } from "./WatchedBy";

/** Quando foi: "hoje", "ontem", "em 3/11/2026" ou, sem data, há quanto tempo foi registrado. */
export function when(entry: CommunityEntry): string {
  if (!entry.consumed_at) return timeAgo(entry.created_at);
  if (entry.consumed_at === localDate()) return "hoje";
  if (entry.consumed_at === localDate(1)) return "ontem";
  return `em ${formatDate(entry.consumed_at)}`;
}

function verb(entry: CommunityEntry): string {
  if (entry.status === "watching") return entry.season ? `está assistindo a temporada ${entry.season} de` : "está assistindo";
  return entry.media.type === "album" ? "ouviu" : entry.consumed_at ? "viu" : "registrou";
}

/**
 * Uma resenha, como nas resenhas populares do Letterboxd: o pôster pequeno à esquerda; o título e o ano; quem escreveu,
 * com a nota e quando; o texto; e curtir e comentar. Sem caixa em volta: uma linha fina separa uma da outra.
 */
export function ReviewPost({ entry, hideAuthor = false }: { entry: CommunityEntry; hideAuthor?: boolean }) {
  const link = `/media/${entry.media.id}`;
  return (
    <article className="flex gap-4 py-6 sm:gap-5">
      <Link to={link} className="w-16 shrink-0 self-start sm:w-[4.5rem]" aria-label={entry.media.title}>
        <Poster media={entry.media} compact rounded="rounded-md" />
      </Link>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl leading-snug font-bold">
          <Link to={link} className="hover:text-accent">
            {entry.media.title}
          </Link>{" "}
          {entry.media.year && <span className="text-base font-normal text-muted">{entry.media.year}</span>}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {!hideAuthor && (
            <Link to={`/pessoas/${entry.user_id}`} className="flex items-center gap-2 font-semibold text-stone-200 hover:text-accent">
              <Avatar name={entry.user_name} userId={entry.user_id} size="h-6 w-6 text-xs" />
              {entry.user_name}
            </Link>
          )}
          {entry.rating != null && <StarsDisplay value={entry.rating} size={14} />}
          <span>{when(entry)}</span>
        </div>
        <SpoilerText text={entry.review!} spoiler={entry.spoiler} className="mt-3 leading-relaxed text-stone-200" />
        <ReviewTalk entry={entry} />
      </div>
    </article>
  );
}

/** Miniatura para a linha do feed: a capa do disco quadrada e o pôster em 2:3, sem o vinil, que não cabe tão pequeno. */
function Thumb({ media }: { media: CommunityEntry["media"] }) {
  if (!media.poster_url) return <Poster media={media} compact rounded="rounded-sm" />;
  return (
    <img
      src={media.poster_url}
      alt=""
      loading="lazy"
      className={`w-full rounded-sm object-cover shadow-md ${media.type === "album" ? "aspect-square" : "aspect-[2/3]"}`}
    />
  );
}

/** Um registro sem resenha: uma linha só, como no feed de atividade. "Davi viu Matrix ★★★★★ · ontem" */
export function LogLine({ entry }: { entry: CommunityEntry }) {
  const link = `/media/${entry.media.id}`;
  return (
    <article className="flex items-center gap-3 py-3 text-sm">
      <Link to={`/pessoas/${entry.user_id}`} aria-label={`Perfil de ${entry.user_name}`}>
        <Avatar name={entry.user_name} userId={entry.user_id} size="h-7 w-7 text-xs" />
      </Link>
      <p className="min-w-0 flex-1 text-muted">
        <Link to={`/pessoas/${entry.user_id}`} className="font-semibold text-stone-200 hover:text-accent">
          {entry.user_name}
        </Link>{" "}
        {verb(entry)}{" "}
        <Link to={link} className="font-semibold text-stone-200 hover:text-accent">
          {entry.media.title}
        </Link>
        {entry.rating != null && (
          <span className="ml-2 inline-block align-[-2px]">
            <StarsDisplay value={entry.rating} size={12} />
          </span>
        )}
        <span> · {when(entry)}</span>
      </p>
      <Link to={link} className="w-9 shrink-0" aria-hidden tabIndex={-1}>
        <Thumb media={entry.media} />
      </Link>
    </article>
  );
}
