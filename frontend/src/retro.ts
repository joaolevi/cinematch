/**
 * Retrospectiva do gosto (RFF05): o diário de um mês ou de um ano, resumido na primeira pessoa.
 * Tudo sai do diário, sem chamar a API, e reaproveita a frase e os números do Meu gosto.
 */
import { formatRating, plural } from "./format";
import { genreTeam, tasteCharts, tasteOf, type Taste } from "./taste";
import type { DiaryEntry } from "./types";

/** Um ano inteiro (`month` nulo) ou um mês dele (de 1 a 12). */
export interface RetroPeriod {
  year: number;
  month: number | null;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const monthName = (month: number) => MONTHS[month - 1];

/** "novembro de 2026" ou "2026". */
export function periodName({ year, month }: RetroPeriod): string {
  return month ? `${monthName(month)} de ${year}` : String(year);
}

/** Os anos com registros datados, do mais recente para o mais antigo, com os meses de cada um. */
export function retroPeriods(entries: DiaryEntry[]): { year: number; months: number[] }[] {
  const years = new Map<number, Set<number>>();
  for (const e of entries) {
    if (!e.consumed_at) continue;
    const year = Number(e.consumed_at.slice(0, 4));
    const month = Number(e.consumed_at.slice(5, 7));
    years.set(year, (years.get(year) ?? new Set()).add(month));
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({ year, months: [...months].sort((a, b) => a - b) }));
}

/** Só o que foi visto ou ouvido no período. Títulos sem data ficam de fora, como no Meu gosto. */
export function inRetro(entries: DiaryEntry[], { year, month }: RetroPeriod): DiaryEntry[] {
  const prefix = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  return entries.filter((e) => e.consumed_at?.startsWith(prefix));
}

/** A idade do gosto: em média, quantos anos tinham os títulos quando a pessoa os viu ou ouviu. */
export function tasteAge(entries: DiaryEntry[], year: number): number | null {
  const ages = entries.filter((e) => e.media.year && e.media.year <= year).map((e) => year - (e.media.year ?? year));
  return ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null;
}

export interface Archetype {
  name: string;
  text: string;
}

/** O arquétipo do período, pela primeira regra que vale. Os nomes não têm gênero gramatical de pessoa. */
export function archetypeOf(entries: DiaryEntry[], age: number | null): Archetype {
  const total = entries.length || 1;
  const share = (type: string) => entries.filter((e) => e.media.type === type).length / total;
  const rated = entries.filter((e) => e.rating != null);
  const avg = rated.length >= 3 ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length : null;
  const genres = new Set(entries.flatMap((e) => e.media.genres)).size;

  if (entries.length < 3) return { name: "Gosto em formação", text: "Poucos registros ainda, mas já dá para ver o começo." };
  if (share("album") >= 0.5) return { name: "Ouvido atento", text: "Mais disco do que tela: a música mandou no meu diário." };
  if (share("series") >= 0.5) return { name: "Maratona sem fim", text: "Uma temporada puxou a outra." };
  if (age != null && age >= 25) return { name: "Alma nostálgica", text: "Os clássicos sempre me chamam de volta." };
  if (age != null && age <= 3) return { name: "Radar de estreias", text: "Saiu, eu já vi ou ouvi." };
  if (genres >= 8) return { name: "Mente curiosa", text: `Passei por ${genres} gêneros, sem medo de coisa nova.` };
  if (avg != null && avg >= 4.5) return { name: "Fã de carteirinha", text: `Quase tudo ganhou nota alta: minha média foi ${formatRating(avg)}.` };
  if (avg != null && avg <= 2.75) return { name: "Paladar exigente", text: `Nota alta só para poucos: minha média foi ${formatRating(avg)}.` };
  return { name: "Gosto equilibrado", text: "Um pouco de cada coisa, na medida certa." };
}

/** "Vi 4 filmes e 1 série e ouvi 6 discos." */
export function countsSentence(entries: DiaryEntry[]): string {
  const count = (type: string) => entries.filter((e) => e.media.type === type).length;
  const [movies, series, albums] = [count("movie"), count("series"), count("album")];
  const seen = [movies && plural(movies, "filme", "filmes"), series && plural(series, "série", "séries")].filter(Boolean);
  const parts = [];
  if (seen.length) parts.push(`vi ${seen.join(" e ")}`);
  if (albums) parts.push(`ouvi ${plural(albums, "disco", "discos")}`);
  const sentence = parts.join(" e ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

/** "da MPB e da bossa nova": os gêneros com artigo, com "e" antes do último. */
export function genreList(genres: string[]): string {
  const words = genres.map(genreTeam);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} e ${words[words.length - 1]}` : (words[0] ?? "");
}

export interface Retro {
  period: RetroPeriod;
  entries: DiaryEntry[];
  taste: Taste | null;
  archetype: Archetype;
  age: number | null;
  counts: string;
  genres: string[]; // de filmes e séries, os 3 mais vistos
  musicGenres: string[]; // dos discos, os 3 mais ouvidos
  average: number | null;
  loved: DiaryEntry[]; // os 5 mais bem avaliados
  revisited: { entry: DiaryEntry; times: number }[]; // o que a pessoa viu ou ouviu mais de uma vez
}

const LOVED_SIZE = 5;

export function retroOf(all: DiaryEntry[], period: RetroPeriod): Retro {
  const entries = inRetro(all, period);
  const charts = tasteCharts(entries);
  const age = tasteAge(entries, period.year);
  const rated = entries.filter((e) => e.rating != null);
  const times = new Map<number, DiaryEntry[]>();
  for (const e of entries) times.set(e.media.id, [...(times.get(e.media.id) ?? []), e]);
  return {
    period,
    entries,
    taste: tasteOf(entries),
    archetype: archetypeOf(entries, age),
    age,
    counts: entries.length ? countsSentence(entries) : "",
    genres: charts.genres.slice(0, 3).map((b) => b.label),
    musicGenres: charts.musicGenres.slice(0, 3).map((b) => b.label),
    average: rated.length ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length : null,
    loved: [...rated]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.consumed_at ?? "").localeCompare(a.consumed_at ?? ""))
      .filter((e, i, list) => list.findIndex((o) => o.media.id === e.media.id) === i) // revisitado conta uma vez
      .slice(0, LOVED_SIZE),
    revisited: [...times.values()]
      .filter((list) => list.length > 1)
      .sort((a, b) => b.length - a.length)
      .map((list) => ({ entry: list[0], times: list.length })),
  };
}
