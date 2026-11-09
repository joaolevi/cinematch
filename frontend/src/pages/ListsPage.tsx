import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import MediaCard from "../components/MediaCard";
import { MEDIA_GRID, tabColor } from "../ui";
import type { UserList } from "../types";
import { usePageTitle } from "../usePageTitle";
import HandNote from "../components/HandNote";
import ListName from "../components/ListName";
import { useDiaryVersion, useSeen } from "../seen";

/** Gerenciar Listas (watchlist "Quero ver" + listas personalizadas). */
export default function ListsPage() {
  usePageTitle("Minhas listas");
  const { user } = useAuth();
  const seen = useSeen(user?.id);
  const [lists, setLists] = useState<UserList[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
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
              {active.items.length === 0 && (
                <HandNote className="mt-6">
                  Esta lista está esperando o primeiro título. Dá para adicionar pela página de cada um
                  {active.is_watchlist ? <> ou pelo botão <ListName />, no feed</> : ""}.
                </HandNote>
              )}
              <div className={`mt-6 ${MEDIA_GRID}`}>
                {active.items.map(({ media }, position) => (
                  <MediaCard
                    key={media.id}
                    media={media}
                    pinned={{ position }}
                    sticker={seen?.has(media.id) ? <span className="text-sm">Visto</span> : undefined}
                    overlay={
                      <button
                        aria-label={`Tirar ${media.title} da lista`}
                        title="Tirar da lista"
                        className="absolute top-3 right-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-bg/80 text-cream shadow-md backdrop-blur-sm transition hover:bg-coral hover:text-bg"
                        onClick={async () => {
                          await api.removeFromList(active.id, media.id);
                          load();
                        }}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                        </svg>
                      </button>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
