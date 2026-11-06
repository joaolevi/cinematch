export function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Par de tons derivado do título (usado no pôster gerado e no fundo do detalhe). */
export function titleHues(title: string): [number, number] {
  const h = hash(title);
  const hue = h % 360;
  return [hue, (hue + 40 + (h % 80)) % 360];
}

// Classes completas (o Tailwind só gera o que aparece literalmente no código).
const GENRE_STYLES = [
  "border-rose-400/30 bg-rose-500/15 text-rose-300",
  "border-orange-400/30 bg-orange-500/15 text-orange-300",
  "border-lime-400/30 bg-lime-500/15 text-lime-300",
  "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  "border-sky-400/30 bg-sky-500/15 text-sky-300",
  "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
  "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-300",
  "border-pink-400/30 bg-pink-500/15 text-pink-300",
];

export function genreStyle(genre: string): string {
  return GENRE_STYLES[hash(genre.toLowerCase()) % GENRE_STYLES.length];
}
