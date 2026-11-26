import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Pair } from "../types";
import Poster from "./Poster";

/** Sessão dupla (RFF27): um filme ou série para ver e um disco para ouvir depois, lado a lado, com a ponte que os liga. */
export default function DoubleFeature({ pairs, onSaved }: { pairs: Pair[]; onSaved: (pair: Pair) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (pairs.length === 0) return null;

  async function saveBoth(pair: Pair) {
    setBusy(pair.album.id);
    setError(null);
    try {
      await api.feedback(pair.video.media.id, "want");
      await api.feedback(pair.album.id, "want");
      onSaved(pair);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="sessao-dupla">
      <h2 id="sessao-dupla" className="font-display text-xl font-bold">
        Sessão dupla
      </h2>
      <p className="mt-1 text-sm text-muted">Para ver e depois ouvir: um filme ou uma série e um disco ligados pela música.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pairs.map((pair) => (
          <article key={`${pair.video.media.id}-${pair.album.id}`} className="card flex flex-col p-4">
            <div className="grid grid-cols-2 gap-3">
              {[pair.video.media, pair.album].map((m) => (
                <Link key={m.id} to={`/media/${m.id}`} className="group block min-w-0" aria-label={m.title}>
                  <Poster media={m} compact />
                  <p className="mt-2 truncate text-sm font-semibold group-hover:text-accent" title={m.title}>
                    {m.title}
                  </p>
                  <p className="text-xs text-muted">
                    {m.type === "album" ? (m.creators[0] ?? "Álbum") : m.type === "movie" ? "Filme" : "Série"}
                    {m.year ? ` · ${m.year}` : ""}
                  </p>
                </Link>
              ))}
            </div>
            <p className="mt-3 font-semibold">{pair.reason}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted" title={pair.video.reason}>
              {pair.video.media.title}: {pair.video.reason.charAt(0).toLowerCase() + pair.video.reason.slice(1)}
            </p>
            <div className="mt-auto pt-3">
              <button className="btn w-full bg-coral/15 text-coral hover:bg-coral hover:text-bg" disabled={busy !== null} onClick={() => saveBoth(pair)}>
                {busy === pair.album.id ? "Guardando..." : "Guardar os dois no Quero ver"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </section>
  );
}
