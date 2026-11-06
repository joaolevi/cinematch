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

  async function wrap(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    wrap(() => api.createList(name.trim())).then(() => setName(""));
  }

  return (
    <>
      <h1>Listas</h1>
      <form className="filters" onSubmit={create}>
        <input
          className="input grow"
          placeholder="Nome da nova lista"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn">Criar lista</button>
      </form>
      {error && <p className="error">{error}</p>}
      {lists === null ? (
        <p className="muted">Carregando…</p>
      ) : (
        lists.map((l, i) => (
          <section key={l.id} className="panel">
            <div className="row">
              <h2 className="grow">{l.name}</h2>
              {i > 0 && (
                <>
                  <button
                    className="btn ghost small"
                    onClick={() => {
                      const n = prompt("Novo nome da lista", l.name);
                      if (n && n.trim()) wrap(() => api.renameList(l.id, n.trim()));
                    }}
                  >
                    Renomear
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={() => confirm(`Excluir a lista "${l.name}"?`) && wrap(() => api.deleteList(l.id))}
                  >
                    Excluir
                  </button>
                </>
              )}
            </div>
            {!l.items || l.items.length === 0 ? (
              <p className="muted small">Lista vazia.</p>
            ) : (
              <div className="grid">
                {l.items.map((m) => (
                  <MediaCard key={m.id} media={m}>
                    <button className="btn ghost small" onClick={() => wrap(() => api.removeFromList(l.id, m.id))}>
                      Remover
                    </button>
                  </MediaCard>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}
