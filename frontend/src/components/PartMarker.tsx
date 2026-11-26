import { useState } from "react";
import type { PartMark } from "../types";
import ActionIcon from "./ActionIcon";
import { StarsInput } from "./Stars";

/** O botão de visto (ou ouvi) de um episódio ou de uma faixa: o olho ou os fones, cheios quando já está marcado. */
export function SeenToggle({
  seen,
  album,
  label,
  busy,
  onToggle,
  size = "h-9 w-9",
}: {
  seen: boolean;
  album: boolean;
  /** O que é: "o episódio 3", "Cais" */
  label: string;
  busy?: boolean;
  onToggle: () => void;
  size?: string;
}) {
  const verb = album ? "ouvi" : "vi";
  return (
    <button
      type="button"
      aria-pressed={seen}
      aria-label={seen ? `Desmarcar: já ${verb} ${label}` : `Marcar que ${verb} ${label}`}
      title={seen ? `Já ${verb}. Clique para desmarcar` : `Marcar que ${verb}`}
      disabled={busy}
      onClick={onToggle}
      className={`grid shrink-0 cursor-pointer place-items-center rounded-full border transition ${size} ${
        seen ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:border-accent hover:text-accent"
      }`}
    >
      <ActionIcon kind={album ? "heard" : "seen"} on={seen} className="h-5 w-5" />
    </button>
  );
}

/**
 * O que a pessoa marca num episódio ou numa faixa, na página dele: visto (ou ouvi), estrelas e uma anotação que só ela
 * vê. Dar nota ou anotar já marca como visto; desmarcar apaga os dois.
 */
export default function PartMarker({
  value,
  album,
  label,
  save,
}: {
  value: PartMark;
  album: boolean;
  label: string;
  save: (data: Partial<PartMark>) => Promise<PartMark>;
}) {
  const [mark, setMark] = useState(value);
  const [note, setNote] = useState(value.note ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(data: Partial<PartMark>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await save(data);
      setMark(next);
      setNote(next.note ?? "");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const verb = album ? "Ouvi" : "Vi";
  return (
    <section className="card p-5" aria-label="O que eu achei">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          aria-pressed={mark.seen}
          disabled={busy}
          onClick={() => send(mark.seen ? { seen: false } : { seen: true, rating: mark.rating, note: mark.note })}
          className={mark.seen ? "btn-seen" : "btn-ghost"}
        >
          <ActionIcon kind={album ? "heard" : "seen"} on={mark.seen} className="h-5 w-5" />
          {mark.seen ? `${verb}!` : `${verb} ${label}`}
        </button>
        <div aria-label="Minha nota" className={busy ? "opacity-60" : ""}>
          <StarsInput value={mark.rating} onChange={(v) => send({ seen: true, rating: v, note: mark.note })} size={28} bare />
        </div>
        {mark.seen && (
          <button
            type="button"
            className="text-xs text-muted underline hover:text-accent"
            disabled={busy}
            onClick={() => send({ seen: false })}
          >
            Desmarcar
          </button>
        )}
      </div>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          send({ seen: true, rating: mark.rating, note });
        }}
      >
        <label htmlFor="anotacao" className="text-sm font-semibold">
          Minha anotação <span className="font-normal text-muted">(só você vê)</span>
        </label>
        <textarea
          id="anotacao"
          value={note}
          maxLength={1000}
          rows={3}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder={album ? "O que essa faixa te lembra?" : "O que você achou deste episódio?"}
          className="input mt-1.5 w-full resize-y text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button className="btn-primary px-4 py-1.5 text-sm" disabled={busy || note.trim() === (mark.note ?? "")}>
            Salvar a anotação
          </button>
          <span role="status" className="text-sm text-muted">
            {busy ? "Salvando..." : saved ? "Salvo" : ""}
          </span>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </section>
  );
}
