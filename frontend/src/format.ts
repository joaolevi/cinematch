export const formatRating = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatDate = (isoDate: string) => new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR");

export const isUpcoming = (year: number | null) => year != null && year > new Date().getFullYear();

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const GENRE_COLORS = ["#5ff5e8", "#b69cff", "#ff8a7a", "#ffc857", "#7cc7ff", "#ff9ed8", "#a8e66b"];

/** Cada gênero tem sempre a mesma cor. */
export function genreColor(genre: string): string {
  const sum = [...genre].reduce((total, char) => total + char.charCodeAt(0), 0);
  return GENRE_COLORS[sum % GENRE_COLORS.length];
}
