import { useId, useState } from "react";
import { formatRating } from "../format";

const STAR_COLOR = "var(--color-amber)";

function Star({ fill }: { fill: 0 | 0.5 | 1 }) {
  const id = `half${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full">
      <defs>
        <linearGradient id={id}>
          <stop offset="50%" stopColor={STAR_COLOR} />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
        fill={fill === 1 ? STAR_COLOR : fill === 0.5 ? `url(#${id})` : "transparent"}
        stroke={STAR_COLOR}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function fillFor(value: number, i: number): 0 | 0.5 | 1 {
  if (value >= i + 1) return 1;
  if (value >= i + 0.5) return 0.5;
  return 0;
}

/** Exibe uma nota de 0 a 5 (passos de 0,5). */
export function StarsDisplay({ value, size = 16 }: { value: number | null; size?: number }) {
  if (value == null) return <span className="text-xs text-muted">sem nota</span>;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: size, height: size }}>
          <Star fill={fillFor(value, i)} />
        </span>
      ))}
    </span>
  );
}

/** Entrada de nota: clicar na metade esquerda da estrela dá meia estrela. */
export function StarsInput({
  value,
  onChange,
  size = 32,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex" onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="relative cursor-pointer" style={{ width: size, height: size }}>
            <Star fill={fillFor(shown, i)} />
            <button
              type="button"
              aria-label={`${i + 0.5} estrelas`}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
              onMouseEnter={() => setHover(i + 0.5)}
              onClick={() => onChange(i + 0.5)}
            />
            <button
              type="button"
              aria-label={`${i + 1} estrelas`}
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
              onMouseEnter={() => setHover(i + 1)}
              onClick={() => onChange(i + 1)}
            />
          </span>
        ))}
      </div>
      <span className="w-16 text-sm text-muted">{value != null ? formatRating(value) : "sem nota"}</span>
      {value != null && (
        <button type="button" className="text-xs text-muted underline hover:text-accent" onClick={() => onChange(null)}>
          limpar
        </button>
      )}
    </div>
  );
}
