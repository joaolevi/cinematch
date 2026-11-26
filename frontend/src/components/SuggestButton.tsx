import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Media, Person } from "../types";
import { Avatar } from "./WatchedBy";

/** "Indicar": escolhe quem você segue, escreve um recado e manda. A pessoa recebe um aviso e vê no Início. */
export default function SuggestButton({ media }: { media: Media }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [to, setTo] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (open && people === null) api.following().then(setPeople).catch(() => setPeople([]));
  }, [open, people]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  async function send() {
    setBusy(true);
    try {
      const { sent } = await api.suggest(media.id, to, note.trim() || undefined);
      const names = (people ?? []).filter((p) => to.includes(p.id)).map((p) => p.name.split(" ")[0]);
      setDone(sent ? `Indicado para ${names.join(" e ")}!` : "Quem você escolheu já viu este título.");
      setTo([]);
      setNote("");
      setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 1800);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 10l13-6-4.5 13-2.5-5.5z" />
          <path d="M9.5 11.5L16.5 4" />
        </svg>
        Indicar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-labelledby="indicar-titulo" onClick={() => setOpen(false)}>
          <div className="rise w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p id="indicar-titulo" className="font-hand text-2xl font-bold text-accent">
              Indicar {media.title}
            </p>
            {done ? (
              <p className="mt-4 text-center font-display text-xl font-bold" role="status">
                {done}
              </p>
            ) : people === null ? (
              <p className="mt-3 text-sm text-muted">Abrindo quem você segue...</p>
            ) : people.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Você ainda não segue ninguém.{" "}
                <Link to="/comunidade/pessoas" className="text-accent underline">
                  Encontrar pessoas
                </Link>
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">Para quem?</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {people.map((p) => {
                    const on = to.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          aria-pressed={on}
                          disabled={!on && to.length >= 10}
                          onClick={() => setTo(on ? to.filter((x) => x !== p.id) : [...to, p.id])}
                          className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition ${on ? "border-accent bg-accent/15 text-accent" : "border-line hover:border-accent/60"}`}
                        >
                          <Avatar name={p.name} userId={p.id} size="h-7 w-7 text-xs" />
                          {p.name.split(" ")[0]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <label htmlFor="recado" className="mt-4 block text-sm text-muted">
                  Um recado <span className="text-xs">(opcional)</span>
                </label>
                <textarea
                  id="recado"
                  value={note}
                  maxLength={280}
                  rows={2}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Você vai amar o final..."
                  className="input mt-1 w-full resize-none text-sm"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn-primary" disabled={busy || to.length === 0} onClick={send}>
                    {busy ? "Mandando..." : to.length > 1 ? `Indicar para ${to.length} pessoas` : "Indicar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
