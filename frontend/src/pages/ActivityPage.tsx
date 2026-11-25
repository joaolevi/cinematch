import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import HandNote from "../components/HandNote";
import Poster from "../components/Poster";
import { StarsDisplay } from "../components/Stars";
import { Avatar } from "../components/WatchedBy";
import { timeAgo } from "../format";
import type { Activity, ActivityFilter } from "../types";
import { usePageTitle } from "../usePageTitle";

const PAGE = 50;

const FILTERS: [ActivityFilter | "", string][] = [
  ["", "Tudo"],
  ["registros", "Registros"],
  ["notas", "Notas"],
  ["resenhas", "Resenhas"],
  ["listas", "Listas"],
  ["curtidas", "Curtidas"],
  ["comentarios", "Comentários"],
  ["seguindo", "Pessoas seguidas"],
];

function Line({ a }: { a: Activity }) {
  const media = a.media && (
    <Link to={`/media/${a.media.id}`} className="font-semibold hover:text-accent">
      {a.media.title}
    </Link>
  );
  const person = a.person && (
    <Link to={`/pessoas/${a.person.id}`} className="font-semibold hover:text-accent">
      {a.person.name}
    </Link>
  );
  let what;
  if (a.kind === "registro") what = <>{a.media?.type === "album" ? "Ouviu" : "Viu"} {media}</>;
  else if (a.kind === "lista") what = <>Guardou {media} em {a.list_name}</>;
  else if (a.kind === "curtida") what = <>Curtiu a resenha de {person} sobre {media}</>;
  else if (a.kind === "comentario") what = <>Comentou a resenha de {person} sobre {media}</>;
  else what = <>Passou a seguir {person}</>;
  return (
    <li className="flex gap-3 border-b border-line/60 py-3">
      {a.media ? (
        <Link to={`/media/${a.media.id}`} className="w-10 shrink-0" aria-hidden tabIndex={-1}>
          <Poster media={a.media} compact rounded="rounded-[2px]" />
        </Link>
      ) : (
        a.person && <Avatar name={a.person.name} size="h-10 w-10" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm">{what}</p>
        {a.kind === "registro" && a.rating != null && (
          <div className="mt-1">
            <StarsDisplay value={a.rating} size={13} />
          </div>
        )}
        {a.text && <p className="mt-1 line-clamp-3 text-sm break-words text-stone-300">{a.text}</p>}
        <p className="mt-1 text-xs text-muted">{timeAgo(a.at)}</p>
      </div>
    </li>
  );
}

/** O próprio histórico de atividades (RFF31), do mais recente ao mais antigo, com filtro por tipo. */
export default function ActivityPage() {
  usePageTitle("Minha atividade");
  const [params, setParams] = useSearchParams();
  const kind = (params.get("tipo") ?? "") as ActivityFilter | "";
  const [items, setItems] = useState<Activity[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    api
      .activity(kind || undefined, PAGE)
      .then((page) => {
        setItems(page);
        setHasMore(page.length === PAGE);
      })
      .catch((e) => setError((e as Error).message));
  }, [kind]);

  async function more() {
    const page = await api.activity(kind || undefined, PAGE, items?.length ?? 0);
    setItems([...(items ?? []), ...page]);
    setHasMore(page.length === PAGE);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Minha atividade</h1>
      <p className="mt-1 text-muted">Tudo o que você fez no Tastory, do mais recente ao mais antigo. Só você vê esta página.</p>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Tipo de atividade">
        {FILTERS.map(([key, label]) => (
          <button
            key={label}
            aria-pressed={kind === key}
            onClick={() => setParams(key ? { tipo: key } : {}, { replace: true })}
            className={`chip cursor-pointer px-3 py-1 text-sm ${kind === key ? "border-accent text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mt-6 text-red-300">{error}</p>}
      {items === null && !error && <HandNote className="mt-6">Folheando o seu caderno...</HandNote>}
      {items?.length === 0 && <HandNote className="mt-6">Nada por aqui ainda.</HandNote>}
      {items && items.length > 0 && (
        <ul className="mt-4">
          {items.map((a, i) => (
            <Line key={`${a.kind}-${a.at}-${i}`} a={a} />
          ))}
        </ul>
      )}
      {hasMore && (
        <button className="btn-ghost mt-6" onClick={more}>
          Ver mais antigas
        </button>
      )}
    </div>
  );
}
