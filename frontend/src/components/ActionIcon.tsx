/**
 * Os ícones das ações, como os do Letterboxd: o mesmo desenho em todas as telas, cheio quando a ação já está feita.
 * Âmbar é registrar (o olho), coral é Quero ver (o marcador). O texto do botão continua: o ícone só reforça.
 */
export type ActionKind = "seen" | "heard" | "want" | "watching" | "skip";

export default function ActionIcon({ kind, on = false, className = "h-4 w-4" }: { kind: ActionKind; on?: boolean; className?: string }) {
  const common = { viewBox: "0 0 20 20", "aria-hidden": true, className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "seen")
    return (
      <svg {...common}>
        <path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z" fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.25 : 0} />
        <circle cx="10" cy="10" r="2.6" fill={on ? "currentColor" : "none"} />
      </svg>
    );
  if (kind === "heard")
    // Fones de ouvido: "ouvi", nas faixas dos álbuns
    return (
      <svg {...common}>
        <path d="M3.5 12.5V10a6.5 6.5 0 0 1 13 0v2.5" />
        <rect x="2.6" y="11.6" width="3.8" height="5.6" rx="1.4" fill={on ? "currentColor" : "none"} />
        <rect x="13.6" y="11.6" width="3.8" height="5.6" rx="1.4" fill={on ? "currentColor" : "none"} />
      </svg>
    );
  if (kind === "want")
    return (
      <svg {...common}>
        <path d="M5.5 2.8h9v14.4L10 13.6l-4.5 3.6z" fill={on ? "currentColor" : "none"} />
      </svg>
    );
  if (kind === "watching")
    return (
      <svg {...common}>
        <path d="M6.5 4.5v11l9-5.5z" fill={on ? "currentColor" : "none"} />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}
