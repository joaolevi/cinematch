import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Arrival } from "../types";

const SEEN_KEY = "tastory.chegadas-vistas";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const keyOf = (a: Arrival) => `${a.media.id}:${a.service.key}`;

/** Aviso do Quero ver (RFF29): o que a pessoa guardou e chegou a um dos serviços dela. "Entendi" esconde neste navegador. */
export default function ArrivalsNote() {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [hidden, setHidden] = useState<string[]>(readSeen);

  useEffect(() => {
    api.arrivals().then(setArrivals).catch(() => {});
  }, []);

  const shown = arrivals.filter((a) => !hidden.includes(keyOf(a)));
  if (shown.length === 0) return null;

  function dismiss() {
    const next = [...hidden, ...shown.map(keyOf)];
    setHidden(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next.slice(-200)));
    } catch {
      // sem armazenamento, o aviso só some até recarregar
    }
  }

  return (
    <aside className="card mt-4 flex max-w-3xl flex-wrap items-start justify-between gap-3 p-4" aria-label="Chegou nos seus serviços">
      <div className="text-sm">
        <p className="font-bold">Do seu Quero ver, chegou nos seus serviços:</p>
        <ul className="mt-1 space-y-0.5">
          {shown.slice(0, 5).map((a) => (
            <li key={keyOf(a)}>
              <Link to={`/media/${a.media.id}`} className="underline hover:text-accent">
                {a.media.title}
              </Link>{" "}
              <span className="text-muted">agora está na {a.service.label}</span>
            </li>
          ))}
        </ul>
        {shown.length > 5 && <p className="text-xs text-muted">E mais {shown.length - 5}.</p>}
      </div>
      <button className="btn-ghost px-3 py-1 text-xs" onClick={dismiss}>
        Entendi
      </button>
    </aside>
  );
}
