import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { localDate } from "../format";
import type { Media, Person } from "../types";
import { Avatar } from "./WatchedBy";

export type ShareMode = "bilhete" | "lembranca";
type Mode = ShareMode;

/** Escolher o filme, a série ou o disco, quando a janela abre fora da página de um título (no Início, por exemplo). */
function MediaPicker({ onPick }: { onPick: (m: Media) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Media[] | null>(null);
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return setFound(null);
    const t = setTimeout(() => api.search({ q: text, limit: 6 }).then((r) => setFound(r.items)).catch(() => setFound([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="mt-4">
      <label htmlFor="compartilhar-busca" className="text-sm text-muted">
        O quê? Um filme, uma série ou um disco
      </label>
      <input
        id="compartilhar-busca"
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Procure pelo nome"
        autoComplete="off"
        className="input mt-1 w-full text-sm"
      />
      {found && (
        <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line" role="listbox" aria-label="Resultados">
          {found.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nada com esse nome.</li>}
          {found.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2">
                {m.poster_url ? (
                  <img src={m.poster_url} alt="" className={`w-8 shrink-0 rounded-sm object-cover ${m.type === "album" ? "aspect-square" : "aspect-[2/3]"}`} />
                ) : (
                  <span className="h-12 w-8 shrink-0 rounded-sm bg-surface-2" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{m.title}</span>
                  <span className="text-xs text-muted">
                    {{ movie: "Filme", series: "Série", album: "Álbum" }[m.type]}
                    {m.year ? ` · ${m.year}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Compartilhar um título com quem você segue, de dois jeitos:
 * - Deixar um bilhete: indicar, com um recado, para uma ou mais pessoas;
 * - Criar lembrança juntos: chamar uma pessoa para ver ou ouvir junto, com um dia combinado.
 */
export default function ShareButton({
  media: fixed,
  initialMode = "bilhete",
  trigger,
}: {
  /** Sem título, a janela começa pedindo para escolher um */
  media?: Media;
  initialMode?: Mode;
  /** Outro botão para abrir a janela, no lugar do "Compartilhar" */
  trigger?: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [picked, setPicked] = useState<Media | null>(null);
  const media = fixed ?? picked;
  const [people, setPeople] = useState<Person[] | null>(null);
  const [to, setTo] = useState<number[]>([]);
  const [day, setDay] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const album = media?.type === "album";

  useEffect(() => {
    if (open && people === null) api.following().then(setPeople).catch(() => setPeople([]));
  }, [open, people]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  function pick(id: number) {
    if (mode === "lembranca") return setTo(to[0] === id ? [] : [id]); // a lembrança é a dois
    setTo(to.includes(id) ? to.filter((x) => x !== id) : to.length < 10 ? [...to, id] : to);
  }

  async function send() {
    if (!media) return;
    setBusy(true);
    setError(null);
    try {
      const names = (people ?? []).filter((p) => to.includes(p.id)).map((p) => p.name.split(" ")[0]);
      if (mode === "bilhete") {
        const { sent } = await api.suggest(media.id, to, note.trim() || undefined);
        setDone(sent ? `Bilhetinho deixado para ${names.join(" e ")}!` : "Quem você escolheu já registrou este título.");
      } else {
        await api.invite(media.id, to[0], day || undefined, note.trim() || undefined);
        setDone(`Convite mandado para ${names[0]}. Agora é esperar o “bora”!`);
      }
      setTo([]);
      setNote("");
      setDay("");
      setTimeout(() => {
        setOpen(false);
        setDone(null);
        if (!fixed) setPicked(null);
      }, 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs: [Mode, string, string][] = [
    ["bilhete", "Deixar um bilhetinho", `Indique ${album ? "este disco" : "este título"} com um recado`],
    ["lembranca", "Criar lembrança juntos", `Chame alguém para ${album ? "ouvir" : "ver"} junto, num dia combinado`],
  ];
  return (
    <>
      {trigger ? (
        trigger(() => {
          setMode(initialMode);
          setOpen(true);
        })
      ) : (
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 10l13-6-4.5 13-2.5-5.5z" />
          <path d="M9.5 11.5L16.5 4" />
        </svg>
        Compartilhar
      </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-labelledby="compartilhar-titulo" onClick={() => setOpen(false)}>
          <div className="rise w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p id="compartilhar-titulo" className="flex items-center gap-2 font-display text-xl font-bold">
              {media ? media.title : mode === "bilhete" ? "Deixar um bilhetinho" : "Criar uma lembrança juntos"}
              {media && !fixed && (
                <button type="button" className="ml-auto text-xs font-normal text-muted underline hover:text-accent" onClick={() => setPicked(null)}>
                  Trocar
                </button>
              )}
            </p>
            <div role="tablist" aria-label="Como compartilhar" className="mt-3 grid grid-cols-2 gap-2">
              {tabs.map(([key, label, hint]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => {
                    setMode(key);
                    setTo(key === "lembranca" ? to.slice(0, 1) : to);
                  }}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition ${mode === key ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"}`}
                >
                  <span className={`block font-hand text-xl leading-6 font-bold ${mode === key ? "text-accent" : "text-cream"}`}>{label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                </button>
              ))}
            </div>
            {!media && !done ? (
              <MediaPicker onPick={setPicked} />
            ) : done ? (
              <p className="mt-6 mb-2 text-center font-display text-xl font-bold" role="status">
                {done}
              </p>
            ) : people === null ? (
              <p className="mt-4 text-sm text-muted">Abrindo quem você segue...</p>
            ) : people.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Você ainda não segue ninguém.{" "}
                <Link to="/comunidade/pessoas" className="text-accent underline">
                  Encontrar pessoas
                </Link>
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm text-muted">{mode === "bilhete" ? "Para quem?" : "Com quem?"}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {people.map((p) => {
                    const on = to.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          aria-pressed={on}
                          onClick={() => pick(p.id)}
                          className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition ${on ? "border-accent bg-accent/15 text-accent" : "border-line hover:border-accent/60"}`}
                        >
                          <Avatar name={p.name} userId={p.id} size="h-7 w-7 text-xs" />
                          {p.name.split(" ")[0]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {mode === "lembranca" && (
                  <>
                    <label htmlFor="dia" className="mt-4 block text-sm text-muted">
                      Quando? <span className="text-xs">(opcional)</span>
                    </label>
                    <input id="dia" type="date" min={localDate()} value={day} onChange={(e) => setDay(e.target.value)} className="input mt-1 w-full text-sm" />
                  </>
                )}
                <label htmlFor="recado" className="mt-4 block text-sm text-muted">
                  Um recado <span className="text-xs">(opcional)</span>
                </label>
                <textarea
                  id="recado"
                  value={note}
                  maxLength={280}
                  rows={2}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={mode === "bilhete" ? "Você vai amar o final..." : "Eu levo a pipoca!"}
                  className="input mt-1 w-full resize-none text-sm"
                />
                {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn-primary" disabled={busy || to.length === 0} onClick={send}>
                    {busy ? "Mandando..." : mode === "bilhete" ? (to.length > 1 ? `Deixar para ${to.length} pessoas` : "Deixar o bilhetinho") : "Mandar o convite"}
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
