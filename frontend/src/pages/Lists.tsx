import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { MediaList } from "../api/types";
import MediaCard from "../components/MediaCard";

export default function Lists() {
  const [lists, setLists] = useState<MediaList[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.lists().then(setLists).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  /** Executa a ação, recarrega as listas e devolve se deu certo. */
  async function wrap(fn: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    try {
      await fn();
      load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      return false;
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (await wrap(() => api.createList(n))) setName("");
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Listas</h1>

      <form className="mt-6 flex max-w-lg gap-2" onSubmit={create}>
        <input
          className="input"
          placeholder="Nome da nova lista"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary shrink-0">Criar lista</button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {lists === null ? (
        <p className="mt-8 text-muted">Carregando…</p>
      ) : (
        <div className="mt-8 space-y-6">
          {lists.map((l, i) => {
            // a primeira lista é sempre a watchlist "Quero ver" e não pode ser editada
            const isWatchlist = l.is_watchlist ?? i === 0;
            // cada item vem como { media, added_at }
            const medias = (l.items ?? []).map((it) => it.media);
            return (
              <section key={l.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold">{l.name}</h2>
                  <span className="chip">{medias.length}</span>
                  {!isWatchlist && (
                    <div className="ml-auto flex gap-2">
                      <button
                        className="btn-ghost px-3 py-1.5"
                        onClick={() => {
                          const n = prompt("Novo nome da lista", l.name);
                          if (n && n.trim()) wrap(() => api.renameList(l.id, n.trim()));
                        }}
                      >
                        Renomear
                      </button>
                      <button
                        className="btn-ghost px-3 py-1.5"
                        onClick={() => confirm(`Excluir a lista "${l.name}"?`) && wrap(() => api.deleteList(l.id))}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

                {medias.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">Lista vazia.</p>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {medias.map((m) => (
                      <MediaCard key={m.id} media={m}>
                        <button
                          className="btn-ghost px-3 py-1.5"
                          onClick={() => wrap(() => api.removeFromList(l.id, m.id))}
                        >
                          Remover
                        </button>
                      </MediaCard>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
