import type { CSSProperties } from "react";

/**
 * Desenhos à mão para as páginas de caderno: traço irregular, ponta redonda e a cor da tinta (currentColor). São só
 * enfeite: ficam escondidos do leitor de tela.
 */
const base = {
  "aria-hidden": true,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type DoodleProps = { className?: string; style?: CSSProperties };

/** Uma estrela de cinco pontas, desenhada de uma vez só, sem tirar a caneta do papel. */
export function StarDoodle({ className = "h-10 w-10", style }: DoodleProps) {
  return (
    <svg {...base} viewBox="0 0 48 48" strokeWidth={2.4} className={className} style={style}>
      <path d="M24 4.5l5.6 13.1 14 1.1-10.7 9.2 3.4 13.7L24.4 34 12.6 41.8l3.6-13.9L5.4 18.9l14.1-1z" />
      <path d="M38 6l2 4M42 9l-4 1" strokeWidth={1.6} />
    </svg>
  );
}

/** Um coração com a linha que não fecha direito, como quem desenha rápido. */
export function HeartDoodle({ className = "h-9 w-9", style }: DoodleProps) {
  return (
    <svg {...base} viewBox="0 0 48 48" strokeWidth={2.4} className={className} style={style}>
      <path d="M24 41C12 32 5 25 6.5 16.5 8 9 17 6.8 22 13.2c1 1.3 1.5 2.2 2 3.3.6-1.4 1.4-2.8 2.7-4 5.6-5.3 14-2.4 14.6 5.4.8 8.6-7 15.4-17.3 23.6" />
    </svg>
  );
}

/** Uma seta curva, para apontar de uma coisa para outra na página. */
export function ArrowDoodle({ className = "h-12 w-20", style }: DoodleProps) {
  return (
    <svg {...base} viewBox="0 0 80 48" strokeWidth={2.2} className={className} style={style}>
      <path d="M4 40c14-2 30-8 42-20 6-6 10-11 14-15" />
      <path d="M50 6c4-1 8-1.5 11-1 .6 3.5 0 7.6-1.4 11" />
    </svg>
  );
}

/** Um disco de vinil: os sulcos em espiral e o selo no meio. */
export function VinylDoodle({ className = "h-14 w-14", style }: DoodleProps) {
  return (
    <svg {...base} viewBox="0 0 56 56" strokeWidth={2} className={className} style={style}>
      <circle cx="28" cy="28" r="24" />
      <path d="M28 10a18 18 0 0 1 18 18M28 15a13 13 0 0 1 13 13M12 30a16 16 0 0 0 14 14" strokeWidth={1.4} />
      <circle cx="28" cy="28" r="6" />
      <circle cx="28" cy="28" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Um rabisco ondulado, para sublinhar ou preencher um canto. */
export function SquiggleDoodle({ className = "h-4 w-24", style }: DoodleProps) {
  return (
    <svg {...base} viewBox="0 0 96 16" strokeWidth={2.2} className={className} style={style}>
      <path d="M3 9c6-6 10 6 16 0s10 6 16 0 10 6 16 0 10 6 16 0 10 6 16 0 6-3 9-2" />
    </svg>
  );
}

/** Uma claquete de cinema simplificada. */
export function ClapperDoodle({ className = "h-12 w-12", style }: DoodleProps) {
  return (
    <svg {...base} viewBox="0 0 48 48" strokeWidth={2.2} className={className} style={style}>
      <path d="M7 20h34v20H7z" />
      <path d="M6 13l32-7 2 7-32 7z" />
      <path d="M14 11.5l4 6M22 9.8l4 6M30 8l4 6" strokeWidth={1.6} />
    </svg>
  );
}
