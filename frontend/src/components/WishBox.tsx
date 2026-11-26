import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { Wish } from "../types";

/** Pedido em português (RFF25): a pessoa escreve o que quer, e o texto vira os filtros de baixo. Sem IA. */
export default function WishBox({ onWish }: { onWish: (wish: Wish | null) => void }) {
  const [text, setText] = useState("");
  const [wish, setWish] = useState<Wish | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAsking(true);
    setError(null);
    try {
      const found = await api.understand(text.trim());
      setWish(found);
      if (found.understood.length) onWish(found);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  function clear() {
    setText("");
    setWish(null);
    onWish(null);
  }

  const understood = wish && wish.understood.length > 0;
  return (
    <form onSubmit={ask} className="flex flex-wrap items-center gap-2" role="search" aria-label="Pedir do seu jeito">
      <label htmlFor="pedido" className="basis-full text-sm text-muted sm:basis-auto">
        Peça do seu jeito:
      </label>
      <input
        id="pedido"
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        placeholder="algo leve para a Sessão da Tarde"
        className="input min-w-48 flex-1 py-1.5 text-sm sm:max-w-md"
      />
      <button className="btn-primary px-3 py-1.5 text-sm" disabled={asking || !text.trim()}>
        Pedir
      </button>
      {wish && (
        <button type="button" className="text-xs text-muted underline hover:text-accent" onClick={clear}>
          Limpar o pedido
        </button>
      )}
      <div className="w-full text-xs text-muted" aria-live="polite">
        {error && <p className="text-red-300">{error}</p>}
        {understood && (
          <p>
            Entendi:{" "}
            {wish.understood.map((part, i) => (
              <span key={i}>
                {i > 0 && " · "}“{part.text}” virou <strong className="text-cream">{part.labels.join(", ")}</strong>
              </span>
            ))}
          </p>
        )}
        {understood && wish.ignored.map((note) => <p key={note}>Ficou de fora: {note}.</p>)}
        {wish && !understood && (
          <p>
            Não entendi esse pedido. Tente um clima (“leve”, “para rir”, “de dar medo”), uma ocasião (“com amigos”, “em
            família”), um tempo (“até 2 horas”) ou um tipo (“uma série”, “um disco”).
          </p>
        )}
      </div>
    </form>
  );
}
