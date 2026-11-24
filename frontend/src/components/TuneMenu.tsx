import { useEffect, useRef, useState } from "react";
import type { Recommendation } from "../types";

export type Tune =
  | { kind: "because" }
  | { kind: "less-genre"; genre: string }
  | { kind: "shorter"; minutes: number }
  | { kind: "lighter" }
  | { kind: "less-famous" };

/** Os ajustes que fazem sentido para esta sugestão (RFF08). */
export function tunesFor(rec: Recommendation, state: { mood: string; maxMinutes: number; discovery: string }): {
  tune: Tune;
  label: string;
}[] {
  const options: { tune: Tune; label: string }[] = [];
  const b = rec.because;
  if (b) {
    options.push({
      tune: { kind: "because" },
      label: b.kind === "title" ? `Não por causa de ${b.label}` : `Não por esse motivo (${b.label})`,
    });
  }
  const genre = rec.media.genres[0];
  if (genre && !(b?.kind === "genre" && b.value === genre)) {
    options.push({ tune: { kind: "less-genre", genre }, label: `Menos ${genre === genre.toUpperCase() ? genre : genre.toLowerCase()}` });
  }
  const minutes = rec.media.duration_min;
  if (minutes && minutes > 40) {
    const limit = Math.max(30, Math.floor((minutes - 15) / 10) * 10);
    if (!state.maxMinutes || limit < state.maxMinutes) options.push({ tune: { kind: "shorter", minutes: limit }, label: "Mais curto" });
  }
  if (state.mood !== "leve") options.push({ tune: { kind: "lighter" }, label: "Mais leve" });
  if (state.discovery === "taste") options.push({ tune: { kind: "less-famous" }, label: "Menos famoso" });
  return options;
}

/** "Ajustar": dar retorno sobre a sugestão e receber um novo lote (RFF08). */
export default function TuneMenu({
  rec,
  state,
  onTune,
}: {
  rec: Recommendation;
  state: { mood: string; maxMinutes: number; discovery: string };
  onTune: (tune: Tune, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const options = tunesFor(rec, state);
  if (options.length === 0) return null;
  return (
    <div ref={box} className="relative mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer text-xs font-semibold text-muted underline decoration-dotted underline-offset-2 hover:text-accent"
      >
        Ajustar
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-[0_10px_30px_rgb(0_0_0/0.5)]"
        >
          <p className="px-2.5 pt-1 pb-1.5 text-xs text-muted">Diga o que mudar e vem um novo lote:</p>
          {options.map(({ tune, label }) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onTune(tune, label);
              }}
              className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2 hover:text-accent"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
