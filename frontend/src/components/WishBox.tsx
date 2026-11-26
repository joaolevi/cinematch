import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Wish } from "../types";

/** Pedidos que o Tastory entende, para mostrar e para clicar. */
export const WISH_EXAMPLES = [
  "algo leve para a Sessão da Tarde",
  "uma série curta de suspense",
  "filme de dar medo com amigos",
  "um disco para relaxar",
  "algo para rir em família até 2 horas",
];

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Os exemplos digitados um por um no campo vazio, letra a letra, como alguém pedindo. Sem movimento, só trocam. */
export function useTypewriter(examples: string[], active: boolean): string {
  const [shown, setShown] = useState(examples[0]);
  useEffect(() => {
    if (!active) return;
    const still = reducedMotion();
    let example = 0;
    let letters = still ? examples[0].length : 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const full = examples[example];
      if (still) {
        example = (example + 1) % examples.length;
        setShown(examples[example]);
        timer = setTimeout(step, 3000);
        return;
      }
      if (!deleting) {
        letters += 1;
        setShown(full.slice(0, letters));
        if (letters >= full.length) {
          deleting = true;
          timer = setTimeout(step, 1800);
          return;
        }
        timer = setTimeout(step, 55);
      } else {
        letters -= 2;
        setShown(full.slice(0, Math.max(0, letters)));
        if (letters <= 0) {
          deleting = false;
          example = (example + 1) % examples.length;
          timer = setTimeout(step, 300);
          return;
        }
        timer = setTimeout(step, 25);
      }
    };
    timer = setTimeout(step, still ? 3000 : 600);
    return () => clearTimeout(timer);
  }, [active, examples]);
  return shown;
}

/**
 * Pedido em português (RFF25): a pessoa escreve o que quer, e o texto vira os filtros. Sem IA. Com `big`, é o destaque
 * do Para você: o campo grande, os exemplos digitados nele e os exemplos para clicar. Com `initial`, o pedido já chega
 * feito (do Início, por exemplo).
 */
export default function WishBox({ onWish, big = false, initial }: { onWish: (wish: Wish | null) => void; big?: boolean; initial?: string }) {
  const [text, setText] = useState(initial ?? "");
  const [focused, setFocused] = useState(false);
  const typed = useTypewriter(WISH_EXAMPLES, big && !focused && !text);
  const asked = useRef(false);
  const [wish, setWish] = useState<Wish | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e?: FormEvent, value = text) {
    e?.preventDefault();
    if (!value.trim()) return;
    setAsking(true);
    setError(null);
    try {
      const found = await api.understand(value.trim());
      setWish(found);
      if (found.understood.length) onWish(found);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  // O pedido que veio de outra tela é feito uma vez, ao abrir
  useEffect(() => {
    if (initial && !asked.current) {
      asked.current = true;
      ask(undefined, initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function clear() {
    setText("");
    setWish(null);
    onWish(null);
  }

  const understood = wish && wish.understood.length > 0;
  const feedback = (
    <div className={`w-full text-xs text-muted ${big ? "mt-3" : ""}`} aria-live="polite">
      {error && <p className="text-red-300">{error}</p>}
      {understood && (
        <p className="flex flex-wrap items-center gap-1.5">
          <span>Entendi:</span>
          {wish.understood.flatMap((part) => part.labels).map((label, i) => (
            <span key={label} className="rise rounded-full bg-accent/15 px-2.5 py-0.5 font-semibold text-accent" style={{ "--i": i } as React.CSSProperties}>
              {label}
            </span>
          ))}
          <button type="button" className="ml-1 underline hover:text-accent" onClick={clear}>
            Limpar o pedido
          </button>
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
  );

  if (big) {
    return (
      <form onSubmit={ask} role="search" aria-label="Pedir do seu jeito">
        <label htmlFor="pedido" className="font-hand text-2xl leading-8 font-bold text-accent">
          Pede aí
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-bg/60 p-1.5 pl-4 transition focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgb(242_179_61/0.15)]">
          <span aria-hidden className="text-lg text-accent">
            ✦
          </span>
          <div className="relative min-w-0 flex-1">
            <input
              id="pedido"
              value={text}
              maxLength={200}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="w-full bg-transparent py-2 text-base text-cream outline-none sm:text-lg"
              aria-describedby="pedido-exemplos"
            />
            {!text && (
              <span aria-hidden className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-base text-muted sm:text-lg ${focused ? "" : "caret"}`}>
                {focused ? "o que você quer ver ou ouvir agora?" : typed}
              </span>
            )}
          </div>
          <button className="btn-primary shrink-0 px-5 py-2" disabled={asking || !text.trim()}>
            {asking ? "Pensando..." : "Pedir"}
          </button>
        </div>
        <div id="pedido-exemplos" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Experimente:</span>
          {WISH_EXAMPLES.slice(0, 4).map((example, i) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example);
                ask(undefined, example);
              }}
              // No celular, dois exemplos bastam
              className={`cursor-pointer rounded-full border border-line px-3 py-1 text-stone-300 transition hover:border-accent hover:text-accent ${i >= 2 ? "max-sm:hidden" : ""}`}
            >
              {example}
            </button>
          ))}
        </div>
        {feedback}
      </form>
    );
  }

  return (
    <form onSubmit={ask} className="flex flex-wrap items-center gap-2" role="search" aria-label="Pedir do seu jeito">
      <label htmlFor="pedido" className="basis-full text-sm text-muted sm:basis-auto">
        Pede aí:
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
