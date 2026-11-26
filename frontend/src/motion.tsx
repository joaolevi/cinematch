import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Quem pediu ao sistema menos movimento não vê animação: os números já aparecem prontos. */
export function calm(): boolean {
  return typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Vira true na primeira vez que o elemento aparece na tela, e fica assim. O ref é uma função: funciona também com
 * elementos que só aparecem depois de carregar. */
export function useInView<T extends Element>(): [(node: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen]);
  return [setEl, seen];
}

/**
 * Um número que conta de 0 até o valor quando aparece na tela, como um placar. Aceita o texto já formatado ("43",
 * "4,8", "63"): se não for número ("–"), mostra como está. O leitor de tela ouve só o valor final.
 */
export function CountUp({ value, duration = 900 }: { value: string | number; duration?: number }) {
  const text = String(value);
  const parts = /^(\d+(?:,\d+)?)(\D*)$/.exec(text.trim());
  const target = parts ? Number(parts[1].replace(",", ".")) : NaN;
  const suffix = parts?.[2] ?? "";
  const decimals = parts?.[1].includes(",") ? parts[1].split(",")[1].length : 0;
  const numeric = parts != null;
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(numeric && !calm() ? 0 : target);

  useEffect(() => {
    if (!numeric || calm()) return setShown(target);
    if (!seen) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(target * (1 - Math.pow(1 - t, 3))); // começa rápido e freia no fim
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, target, numeric, duration]);

  if (!numeric) return <>{text}</>;
  const label = decimals ? shown.toFixed(decimals).replace(".", ",") : String(Math.round(shown));
  return (
    <span ref={ref}>
      <span aria-hidden className="tabular-nums">
        {label}
        {suffix}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** Umas pipocas que pulam do canto do cartão e caem. Cada `burst` novo solta outra leva. */
export function Popcorn({ burst }: { burst: number }) {
  if (!burst || calm()) return null;
  const kernels = [
    [-70, -46, -40],
    [-40, -70, 25],
    [-10, -58, -15],
    [-95, -20, 60],
    [-55, -30, -70],
    [-25, -84, 40],
    [-80, -64, 15],
  ];
  return (
    <span key={burst} aria-hidden className="pointer-events-none absolute top-5 right-6 z-20">
      {kernels.map(([dx, dy, r], i) => (
        <span
          key={i}
          className="popcorn absolute text-lg"
          style={
            {
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              "--r": `${r}deg`,
              animationDelay: `${i * 45}ms`,
            } as React.CSSProperties
          }
        >
          🍿
        </span>
      ))}
    </span>
  );
}

/** Um aviãozinho de papel que sai do botão e voa para fora da tela: o bilhete foi mandado. */
export function PaperPlane({ from }: { from: { x: number; y: number } | null }) {
  if (!from || calm()) return null;
  return createPortal(
    <span
      aria-hidden
      className="plane-fly pointer-events-none fixed z-[80] text-accent"
      style={{ left: from.x, top: from.y }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-9 w-9 drop-shadow-[0_4px_8px_rgb(0_0_0/0.5)]"
        fill="#f6d27a"
        stroke="#2b211c"
        strokeWidth={1.2}
        strokeLinejoin="round"
      >
        <path d="M22 2 2 9.5l7.5 3L12 20l3-5.5L22 2Z" />
        <path d="M9.5 12.5 22 2" fill="none" />
      </svg>
    </span>,
    document.body,
  );
}

/** Dá um pulinho no elemento (o cartão que acabou de ser ligado, por exemplo). */
export function jump(el: Element | null) {
  if (!el || calm() || !("animate" in el)) return;
  el.animate(
    [
      { transform: "none" },
      { transform: "translateY(-6px) scale(1.02)" },
      { transform: "translateY(1px)" },
      { transform: "none" },
    ],
    { duration: 450, easing: "cubic-bezier(.34,1.56,.64,1)" },
  );
}
