import { colorFor, formatDate, localDate, timeAgo } from "../format";
import { StarsDisplay } from "./Stars";

export function Avatar({ name, size }: { name: string; size: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-bg ${size}`}
      style={{ backgroundColor: colorFor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function watchedWhen(consumedAt: string): string {
  if (consumedAt === localDate()) return "hoje";
  if (consumedAt === localDate(1)) return "ontem";
  return `em ${formatDate(consumedAt)}`;
}

/** Quem viu, com a nota e quando viu. Sem data informada, mostra quando a pessoa registrou. */
export default function WatchedBy({
  name,
  rating,
  consumedAt,
  createdAt,
}: {
  name: string;
  rating: number | null;
  consumedAt: string | null;
  createdAt: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <Avatar name={name} size="h-6 w-6 text-xs" />
      {rating != null && <StarsDisplay value={rating} size={14} />}
      <span>
        {consumedAt ? "Visto" : "Registrado"} por <strong className="text-slate-200">{name}</strong>{" "}
        {consumedAt ? watchedWhen(consumedAt) : timeAgo(createdAt)}
      </span>
    </div>
  );
}
