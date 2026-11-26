import { Link } from "react-router-dom";
import { useAvatarUrl } from "../avatars";
import { colorFor, formatDate, localDate, timeAgo } from "../format";
import { StarsDisplay } from "./Stars";

/** A foto da pessoa ou, sem foto, a inicial do nome num círculo colorido. */
export function Avatar({ name, size, userId }: { name: string; size: string; userId?: number }) {
  const url = useAvatarUrl(userId);
  if (url) return <img src={url} alt="" aria-hidden className={`shrink-0 rounded-full object-cover ${size}`} />;
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
  userId,
}: {
  name: string;
  /** Com o id, o nome leva ao perfil da pessoa */
  userId?: number;
  rating: number | null;
  consumedAt: string | null;
  createdAt: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <Avatar name={name} userId={userId} size="h-6 w-6 text-xs" />
      {rating != null && <StarsDisplay value={rating} size={14} />}
      <span>
        {consumedAt ? "Visto" : "Registrado"} por{" "}
        {userId ? (
          <Link to={`/pessoas/${userId}`} className="font-bold text-stone-200 hover:text-accent hover:underline">
            {name}
          </Link>
        ) : (
          <strong className="text-stone-200">{name}</strong>
        )}{" "}
        {consumedAt ? watchedWhen(consumedAt) : timeAgo(createdAt)}
      </span>
    </div>
  );
}
