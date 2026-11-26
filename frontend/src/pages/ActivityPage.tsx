import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import HandNote from "../components/HandNote";
import Poster from "../components/Poster";
import { StarsDisplay } from "../components/Stars";
import { Avatar } from "../components/WatchedBy";
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

/** "Hoje", "Ontem" ou "Terça, 24 de novembro": o título de cada dia na lista. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key(d) === key(today)) return "Hoje";
  if (key(d) === key(yesterday)) return "Ontem";
  const label = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function hourOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

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
    // Uma linha só por atividade: a miniatura pequena, o que foi feito com as estrelas ao lado e a hora no canto
    <li className="flex items-start gap-3 py-2">
      {a.media ? (
        <Link to={`/media/${a.media.id}`} className="w-7 shrink-0" aria-hidden tabIndex={-1}>
          {a.media.poster_url ? (
            <img
              src={a.media.poster_url}
              alt=""
              loading="lazy"
              className={`w-full rounded-sm object-cover ${a.media.type === "album" ? "aspect-square" : "aspect-[2/3]"}`}
            />
          ) : (
            <Poster media={a.media} compact rounded="rounded-[2px]" />
          )}
        </Link>
      ) : (
        a.person && <Avatar name={a.person.name} userId={a.person.id} size="h-7 w-7 text-xs" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {what}
          {a.kind === "registro" && a.rating != null && (
            <span className="ml-2 inline-block align-[-2px]">
              <StarsDisplay value={a.rating} size={12} />
            </span>
          )}
        </p>
        {a.text && <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted">“{a.text}”</p>}
      </div>
      <time className="shrink-0 pt-0.5 text-xs text-muted" dateTime={a.at}>
        {hourOf(a.at)}
      </time>
    </li>
  );
}

function days(items: Activity[]): [string, Activity[]][] {
  const map = new Map<string, Activity[]>();
  for (const a of items) map.set(dayLabel(a.at), [...(map.get(dayLabel(a.at)) ?? []), a]);
  return [...map.entries()];
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
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Minha atividade</h1>
      <p className="font-hand text-2xl font-bold text-accent">tudo o que eu fiz, dia a dia</p>
      <p className="mt-1 text-sm text-muted">Tudo o que você fez no Tastory, do mais recente ao mais antigo. Só você vê esta página.</p>
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
      {/* Separada por dia, como um caderno: o título de cada dia escrito à mão e as atividades dele embaixo */}
      {items && items.length > 0 && (
        <div className="mt-6 space-y-6">
          {days(items).map(([label, list]) => (
            <section key={label} aria-label={label}>
              <h2 className="border-b border-line/60 pb-1 font-hand text-xl font-bold text-accent">{label}</h2>
              <ul className="mt-1">
                {list.map((a, i) => (
                  <Line key={`${a.kind}-${a.at}-${i}`} a={a} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {hasMore && (
        <button className="btn-ghost mt-6" onClick={more}>
          Ver mais antigas
        </button>
      )}
    </div>
  );
}
