import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { OnMyServices } from "../components/Highlight";
import { useMoods } from "../moods";
import { useAuth } from "../auth";
import MediaCard from "../components/MediaCard";
import { MEDIA_GRID, tabColor } from "../ui";
import type { Media, UserList, WatchlistNow } from "../types";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import ListName from "../components/ListName";
import { seenLabel, useDiaryVersion, useSeen } from "../seen";

/** O Quero ver ordenado pelo que combina agora (RFF22): gosto, momento e os serviços da pessoa. */
function WatchlistNowView({ version, renderCard }: { version: number; renderCard: (media: Media, position: number) => ReactNode }) {
  const { user } = useAuth();
  const moods = useMoods();
  const [mood, setMood] = useState("");
  const [maxMinutes, setMaxMinutes] = useState(0);
  const [onlyMine, setOnlyMine] = useState(false);
  const [data, setData] = useState<WatchlistNow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasServices = (user?.services.length ?? 0) > 0;

  useEffect(() => {
    setError(null);
    api
      .watchlistNow({ mood: mood || undefined, max_minutes: maxMinutes || undefined, only_mine: onlyMine || undefined })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [mood, maxMinutes, onlyMine, version]);

  const chip = (on: boolean) => `chip cursor-pointer px-3 py-1 text-sm ${on ? "border-accent text-accent" : ""}`;
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="O que combina agora">
        <span className="text-sm text-muted">Agora:</span>
        <label className="sr-only" htmlFor="clima-lista">
          Clima
        </label>
        <select id="clima-lista" value={mood} onChange={(e) => setMood(e.target.value)} className={`${chip(!!mood)} bg-surface`}>
          <option value="">Qualquer clima</option>
          {moods.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        {(
          [
            [0, "Qualquer duração"],
            [90, "Até 1h30"],
            [150, "Até 2h30"],
          ] as const
        ).map(([minutes, label]) => (
          <button key={minutes} aria-pressed={maxMinutes === minutes} onClick={() => setMaxMinutes(minutes)} className={chip(maxMinutes === minutes)}>
            {label}
          </button>
        ))}
        {hasServices ? (
          <button aria-pressed={onlyMine} onClick={() => setOnlyMine(!onlyMine)} className={chip(onlyMine)}>
            Só nos meus serviços
          </button>
        ) : (
          <Link to="/conta#servicos" className="text-xs text-muted underline hover:text-accent">
            Marcar os serviços que eu assino
          </Link>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Do que mais combina com o seu gosto ao que menos. O que está nos seus serviços sobe um pouco.
      </p>
      {error && <p className="mt-4 text-red-300">{error}</p>}
      {data && data.items.length === 0 && (
        <HandNote className="mt-6">Nada do seu Quero ver cabe nesse momento. Tente outro clima ou outra duração.</HandNote>
      )}
      {data && data.items.length > 0 && (
        <div className={`mt-6 ${MEDIA_GRID}`}>
          {data.items.map((rec, position) => (
            <div key={rec.media.id}>
              {renderCard(rec.media, position)}
              <p className="mt-1.5 line-clamp-2 text-xs text-muted" title={rec.reason}>
                {rec.reason}
              </p>
              <OnMyServices rec={rec} className="mt-1 text-xs" logos={false} />
            </div>
          ))}
        </div>
      )}
      {data && data.later.length > 0 && (
        <section className="mt-10">
          <h3 className="font-display text-lg font-bold">Para outro momento</h3>
          <p className="text-sm text-muted">Não cabem no que você escolheu agora.</p>
          <div className={`mt-4 opacity-70 ${MEDIA_GRID}`}>
            {data.later.map((rec, position) => (
              <div key={rec.media.id}>{renderCard(rec.media, data.items.length + position)}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Gerenciar Listas (watchlist "Quero ver" + listas personalizadas). */
export default function ListsPage() {
  usePageTitle("Minhas listas");
  const { user } = useAuth();
  const seen = useSeen(user?.id);
  const [lists, setLists] = useState<UserList[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [order, setOrder] = useState<"saved" | "now">("saved"); // no Quero ver: guardados por último ou o que combina agora
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const l = await api.lists();
      setLists(l);
      setActiveId((cur) => (cur && l.some((x) => x.id === cur) ? cur : (l[0]?.id ?? null)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // O Registrar tira o título do Quero ver: recarrega quando o diário muda
  const version = useDiaryVersion();
  useEffect(() => {
    load();
  }, [version]);

  const active = lists.find((l) => l.id === activeId) ?? null;

  const card = (listId: number, media: Media) => (
    <MediaCard
      key={media.id}
      media={media}
      sticker={seenLabel(seen?.get(media.id)) ? <span className="text-sm">{seenLabel(seen?.get(media.id))}</span> : undefined}
      overlay={
        <button
          aria-label={`Tirar ${media.title} da lista`}
          title="Tirar da lista"
          className="absolute top-3 right-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-bg/80 text-cream shadow-md backdrop-blur-sm transition hover:bg-coral hover:text-bg"
          onClick={async () => {
            await api.removeFromList(listId, media.id);
            load();
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      }
    />
  );

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = await api.createList(newName.trim());
    setNewName("");
    setActiveId(created.id);
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Listas</h1>
      {error && <p className="mt-4 text-red-300">{error}</p>}

      {/* Cada lista é uma aba de fichário, com a sua cor */}
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line">
        <div role="tablist" aria-label="Minhas listas" className="flex flex-wrap gap-1">
          {lists.map((l, position) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={l.id === activeId}
              onClick={() => setActiveId(l.id)}
              className="nb-tab"
              style={tabColor(position)}
            >
              {l.is_watchlist ? "★ " : ""}
              {l.name} <span className="ml-1 text-xs font-semibold opacity-70">{l.items.length}</span>
            </button>
          ))}
        </div>
        <form onSubmit={create} className="ml-auto flex gap-2 pb-2">
          <input
            className="input w-44"
            placeholder="Nova lista"
            aria-label="Nome da nova lista"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-primary px-3 whitespace-nowrap">Criar lista</button>
        </form>
      </div>

      <div className="mt-6">
        <section>
          {active && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold">{active.name}</h2>
                {!active.is_watchlist && (
                  <>
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      onClick={async () => {
                        const name = prompt("Novo nome da lista", active.name);
                        if (name?.trim()) {
                          await api.renameList(active.id, name.trim());
                          load();
                        }
                      }}
                    >
                      Renomear
                    </button>
                    <button
                      className="btn-danger px-3 py-1 text-xs"
                      onClick={async () => {
                        if (confirm(`Excluir a lista "${active.name}"?`)) {
                          await api.deleteList(active.id);
                          setActiveId(null);
                          load();
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
              {active.is_watchlist && active.items.length > 1 && (
                <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Ordem">
                  <span className="text-sm text-muted">Ordem:</span>
                  {(
                    [
                      ["saved", "Guardados por último"],
                      ["now", "O que combina agora"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={order === key}
                      onClick={() => setOrder(key)}
                      className={`chip cursor-pointer px-3 py-1 text-sm ${order === key ? "border-accent text-accent" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {active.items.length === 0 && (
                <HandNote className="mt-6">
                  Esta lista está esperando o primeiro título. Dá para adicionar pela página de cada um
                  {active.is_watchlist ? <> ou pelo botão <ListName />, no feed</> : ""}.
                </HandNote>
              )}
              {active.is_watchlist && order === "now" && active.items.length > 1 ? (
                <WatchlistNowView
                  version={version + active.items.length}
                  renderCard={(media) => card(active.id, media)}
                />
              ) : (
                <div className={`mt-6 ${MEDIA_GRID}`}>
                  {active.items.map(({ media }) => card(active.id, media))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

