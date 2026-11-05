import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import MediaCard from "../components/MediaCard";
import type { UserList } from "../types";

/** Gerenciar Listas (watchlist "Quero ver" + listas personalizadas). */
export default function ListsPage() {
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

  useEffect(() => {
    load();
  }, []);

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

      <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveId(l.id)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                l.id === activeId ? "bg-surface-2 text-accent" : "hover:bg-surface"
              }`}
            >
              <span className="font-medium">{l.is_watchlist ? "★ " : ""}{l.name}</span>
              <span className="text-xs text-muted">{l.items.length}</span>
            </button>
          ))}
          <form onSubmit={create} className="flex gap-2 pt-3">
            <input className="input" placeholder="Nova lista" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn-primary px-3">+</button>
          </form>
        </aside>

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
                <p className="mt-4 text-sm text-muted">
                  Lista vazia. Adicione títulos pela página de cada mídia{active.is_watchlist ? " ou pelo botão “+ Quero” no feed" : ""}.
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-5">
                {active.items.map(({ media }) => (
                  <MediaCard key={media.id} media={media}>
                    <button
                      className="btn-ghost mt-2 px-2 py-1 text-xs"
                      onClick={async () => {
                        await api.removeFromList(active.id, media.id);
                        load();
                      }}
                    >
                      Remover
                    </button>
                  </MediaCard>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
