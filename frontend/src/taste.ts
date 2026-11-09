import { formatRating, localDate } from "./format";
import type { DiaryEntry } from "./types";

/** Como cada gênero entra na frase "Sou do time ...". */
const GENRE_TEAM: Record<string, string> = {
  Ação: "da ação",
  Animação: "da animação",
  Aventura: "da aventura",
  Comédia: "da comédia",
  Crime: "do crime",
  Documentário: "do documentário",
  Drama: "do drama",
  Família: "dos títulos de família",
  Fantasia: "da fantasia",
  Faroeste: "do faroeste",
  "Ficção Científica": "da ficção científica",
  Guerra: "dos títulos de guerra",
  Histórico: "das histórias reais",
  Mistério: "do mistério",
  Musical: "do musical",
  Romance: "do romance",
  Suspense: "do suspense",
  Terror: "do terror",
};

export const MIN_ENTRIES_FOR_TASTE = 3;

export function decadeName(decade: number): string {
  return decade < 2000 ? `anos ${decade % 100}` : `anos ${decade}`;
}

function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

function countBy<T>(items: T[], key: (item: T) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) for (const k of key(item)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function average(entries: DiaryEntry[]): number | null {
  const rated = entries.filter((e) => e.rating != null);
  return rated.length ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length : null;
}

// ---------------------------------------------------------------- frase do gosto

export interface Taste {
  highlight: string; // ex.: "do drama"
  decade: string | null;
  facts: string[];
}

/** Resume o gosto em uma frase, na primeira pessoa, como num diário. Usa só o que a pessoa curtiu. */
export function tasteOf(entries: DiaryEntry[]): Taste | null {
  if (entries.length < MIN_ENTRIES_FOR_TASTE) return null;
  const liked = entries.filter((e) => e.rating == null || e.rating >= 3);
  const base = liked.length >= MIN_ENTRIES_FOR_TASTE ? liked : entries;

  const [topGenre] = countBy(base, (e) => e.media.genres.slice(0, 2));
  if (!topGenre) return null;
  const highlight = GENRE_TEAM[topGenre[0]] ?? `de ${topGenre[0].toLowerCase()}`;

  const dated = base.filter((e) => e.media.year);
  const [topDecade] = countBy(dated, (e) => [String(decadeOf(e.media.year ?? 0))]);
  const decade = topDecade && topDecade[1] / dated.length >= 0.4 ? decadeName(Number(topDecade[0])) : null;

  const facts: string[] = [];
  const avg = entries.filter((e) => e.rating != null).length >= MIN_ENTRIES_FOR_TASTE ? average(entries) : null;
  if (avg != null) {
    const note = formatRating(avg);
    if (avg >= 4) facts.push(`Coração mole: minha nota média é ${note}.`);
    else if (avg <= 2.75) facts.push(`Difícil de agradar: minha nota média é ${note}.`);
    else facts.push(`Nota alta só quando merece: minha média é ${note}.`);
  }
  const series = entries.filter((e) => e.media.type === "series").length / entries.length;
  if (series >= 0.6) facts.push(`Séries são a minha praia: ${Math.round(series * 100)}% do meu diário.`);
  else if (series <= 0.4) facts.push(`Filmes em primeiro lugar: ${Math.round((1 - series) * 100)}% do meu diário.`);
  else facts.push("Filmes e séries, na mesma medida.");
  const [topCreator] = countBy(base, (e) => e.media.creators);
  if (topCreator && topCreator[1] >= 2) facts.push(`Quem mais aparece no meu diário: ${topCreator[0]}.`);

  return { highlight, decade, facts };
}

// ---------------------------------------------------------------- números dos post-its

export interface Note {
  value: string;
  label: string;
  color: string;
}

const NOTE_COLORS = ["#f6d27a", "#f3a48f", "#b7d1b9", "#f2b8c8", "#b9d0e4", "#d4c3ea"];

/** Os números grandes do diário, escritos em post-its, na primeira pessoa. */
export function notesOf(entries: DiaryEntry[], today = new Date()): Note[] {
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`; // no fuso de quem usa
  const monthName = today.toLocaleDateString("pt-BR", { month: "long" });
  const avg = average(entries);
  const genres = new Set(entries.flatMap((e) => e.media.genres)).size;
  const notes = [
    { value: String(entries.length), label: entries.length === 1 ? "título no meu diário" : "títulos no meu diário" },
    { value: String(entries.filter((e) => e.consumed_at?.startsWith(month)).length), label: `vi em ${monthName}` },
    { value: avg != null ? formatRating(avg) : "–", label: avg != null ? "minha nota média" : "ainda sem notas" },
    { value: String(entries.filter((e) => e.rating === 5).length), label: "ganharam 5 estrelas" },
    { value: String(entries.filter((e) => e.review).length), label: "resenhas que escrevi" },
    { value: String(genres), label: genres === 1 ? "gênero explorado" : "gêneros explorados" },
  ];
  return notes.map((note, i) => ({ ...note, color: NOTE_COLORS[i % NOTE_COLORS.length] }));
}

// ---------------------------------------------------------------- filtros

/** Recorte do diário escolhido ao clicar em um gráfico. */
export interface DiaryFilter {
  kind: "genre" | "decade" | "before" | "rating" | "creator" | "type";
  value: string;
  label: string;
}

export function matches(entry: DiaryEntry, filter: DiaryFilter): boolean {
  const { media } = entry;
  switch (filter.kind) {
    case "genre":
      return media.genres.includes(filter.value);
    case "creator":
      return media.creators.includes(filter.value);
    case "decade":
      return media.year != null && decadeOf(media.year) === Number(filter.value);
    case "before":
      return media.year != null && media.year < Number(filter.value);
    case "rating":
      return entry.rating != null && Math.round(entry.rating * 2) === Math.round(Number(filter.value) * 2);
    case "type":
      return media.type === filter.value;
  }
}

export type Period = "always" | "year" | "30days";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "always", label: "Desde sempre" },
  { key: "year", label: "Este ano" },
  { key: "30days", label: "Últimos 30 dias" },
];

/** Só o que foi visto no período. Títulos sem data entram apenas em "Desde sempre". */
export function inPeriod(entries: DiaryEntry[], period: Period, today = new Date()): DiaryEntry[] {
  if (period === "always") return entries;
  const from = period === "year" ? `${today.getFullYear()}-01-01` : localDate(30);
  return entries.filter((e) => e.consumed_at != null && e.consumed_at >= from);
}

// ---------------------------------------------------------------- gráficos

export interface Bar {
  label: string;
  value: number;
  filter: DiaryFilter;
}

export interface TasteCharts {
  total: number;
  genres: Bar[];
  decades: Bar[];
  ratings: Bar[]; // de 0,5 a 5, nesta ordem
  creators: Bar[];
  types: Bar[];
}

const MAX_DECADES = 8;

/** Números da aba Meu gosto. Tudo sai do diário, sem chamar a API. */
export function tasteCharts(entries: DiaryEntry[]): TasteCharts {
  const genres = countBy(entries, (e) => e.media.genres)
    .slice(0, 6)
    .map(([label, value]): Bar => ({ label, value, filter: { kind: "genre", value: label, label } }));

  const byDecade = new Map<number, number>();
  for (const e of entries) {
    if (!e.media.year) continue;
    const decade = decadeOf(e.media.year);
    byDecade.set(decade, (byDecade.get(decade) ?? 0) + 1);
  }
  const decades: Bar[] = [];
  if (byDecade.size > 0) {
    const last = Math.max(...byDecade.keys());
    const first = Math.max(Math.min(...byDecade.keys()), last - (MAX_DECADES - 1) * 10);
    const older = [...byDecade.entries()].filter(([d]) => d < first).reduce((sum, [, n]) => sum + n, 0);
    if (older > 0) {
      const label = `Antes dos ${decadeName(first)}`;
      decades.push({ label, value: older, filter: { kind: "before", value: String(first), label } });
    }
    for (let d = first; d <= last; d += 10) {
      const label = capitalize(decadeName(d));
      decades.push({ label, value: byDecade.get(d) ?? 0, filter: { kind: "decade", value: String(d), label } });
    }
  }

  const ratings: Bar[] = Array.from({ length: 10 }, (_, i) => {
    const label = ((i + 1) / 2).toLocaleString("pt-BR");
    return { label, value: 0, filter: { kind: "rating", value: String((i + 1) / 2), label: `Nota ${label}` } };
  });
  for (const e of entries) {
    if (e.rating == null) continue;
    const step = Math.min(10, Math.max(1, Math.round(e.rating * 2)));
    ratings[step - 1].value += 1;
  }

  const creators = countBy(entries, (e) => e.media.creators)
    .filter(([, n]) => n >= 2)
    .slice(0, 5)
    .map(([label, value]): Bar => ({ label, value, filter: { kind: "creator", value: label, label } }));

  const series = entries.filter((e) => e.media.type === "series").length;
  const types: Bar[] = [
    { label: "Filmes", value: entries.length - series, filter: { kind: "type", value: "movie", label: "Filmes" } },
    { label: "Séries", value: series, filter: { kind: "type", value: "series", label: "Séries" } },
  ];
  return { total: entries.length, genres, decades, ratings, creators, types };
}
