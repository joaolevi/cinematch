import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { DiaryEntry, Media } from "../types";
import Polaroid from "./Polaroid";
import Poster from "./Poster";

const MAX = 4;

/** Para procurar sem diferenciar acentos nem maiúsculas. */
function search_text(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Escolher os quatro favoritos entre os títulos do próprio diário, na ordem dos cliques. */
function Picker({
  entries,
  initial,
  onSaved,
  onCancel,
}: {
  entries: DiaryEntry[];
  initial: Media[];
  onSaved: (pinned: Media[]) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<number[]>(initial.map((m) => m.id));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titles = useMemo(() => {
    const unique = new Map(entries.map((e) => [e.media.id, e.media]));
    const needle = search_text(q.trim());
    return [...unique.values()].filter((m) => !needle || search_text(m.title).includes(needle));
  }, [entries, q]);

  function toggle(id: number) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX ? [...c, id] : c));
  }

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          Escolha até {MAX} títulos do seu diário, na ordem em que quer mostrar: <b>{chosen.length} de {MAX}</b>
        </p>
        <label className="sr-only" htmlFor="favoritos-busca">
          Procurar no diário
        </label>
        <input
          id="favoritos-busca"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar no diário"
          className="input ml-auto w-56 py-1.5 text-sm"
        />
      </div>
      <ul className="mt-4 grid max-h-[26rem] grid-cols-4 gap-3 overflow-y-auto sm:grid-cols-6 lg:grid-cols-10">
        {titles.map((m) => {
          const position = chosen.indexOf(m.id);
          return (
            <li key={m.id}>
              <button
                aria-pressed={position >= 0}
                onClick={() => toggle(m.id)}
                title={m.title}
                className={`relative block w-full cursor-pointer rounded-md p-0.5 ${position >= 0 ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100"}`}
              >
                <Poster media={m} compact rounded="rounded-[3px]" />
                {position >= 0 && (
                  <span className="absolute top-1 left-1 grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-bg">
                    {position + 1}
                  </span>
                )}
                <span className="sr-only">{m.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              onSaved(await api.setFavorites(chosen));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Salvando..." : "Salvar meus favoritos"}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Os quatro favoritos do perfil, como o cartão de visita do Letterboxd: quatro polaroides grandes, na ordem que a
 * pessoa escolheu. No próprio perfil, dá para escolher entre os títulos do diário.
 */
export default function PinnedFavorites({
  pinned,
  isMe,
  who,
  entries,
}: {
  pinned: Media[];
  isMe: boolean;
  who: string;
  entries: DiaryEntry[] | null;
}) {
  const [current, setCurrent] = useState(pinned);
  const [editing, setEditing] = useState(false);
  if (!isMe && current.length === 0) return null;
  return (
    <section aria-labelledby="favoritos-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="favoritos-titulo" className="font-display text-xl font-bold">
          {isMe ? "Meus quatro favoritos" : `Os quatro favoritos de ${who}`}
        </h2>
        {isMe && !editing && (
          <button className="btn-ghost px-3 py-1 text-sm" onClick={() => setEditing(true)} disabled={!entries?.length}>
            {current.length ? "Trocar meus favoritos" : "Escolher meus favoritos"}
          </button>
        )}
      </div>
      {editing && entries ? (
        <Picker
          entries={entries}
          initial={current}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setCurrent(saved);
            setEditing(false);
          }}
        />
      ) : current.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Escolha os quatro títulos que dizem quem você é: eles ficam no topo do seu perfil, para quem visitar.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4 lg:max-w-4xl">
          {current.map((m, i) => (
            <li key={m.id}>
              <Link to={`/media/${m.id}`} className="block" aria-label={m.title}>
                <Polaroid position={i} album={m.type === "album"} straightenOnHover={false}>
                  <Poster media={m} rounded="rounded-[2px]" />
                </Polaroid>
              </Link>
              <p className="mt-2 line-clamp-2 text-sm font-semibold">{m.title}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
