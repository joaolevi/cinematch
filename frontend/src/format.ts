export const formatRating = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatDate = (isoDate: string) => new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR");

export const isUpcoming = (year: number | null) => year != null && year > new Date().getFullYear();

export function localDate(daysAgo = 0): string {
  const day = new Date();
  day.setDate(day.getDate() - daysAgo);
  return new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function timeAgo(isoDate: string): string {
  const date = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(isoDate) ? isoDate : `${isoDate}Z`);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${plural(minutes, "minuto", "minutos")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${plural(hours, "hora", "horas")}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return days < 30 ? `há ${days} dias` : date.toLocaleDateString("pt-BR");
}

const COLORS = ["#f2b33d", "#e8735a", "#7fa58b", "#e59bb0", "#8fb3c9", "#b39ddb", "#c9b27c"];

/** Cada tipo de mídia tem sua cor; os álbuns, em sálvia. */
// As cores vêm do tema (index.css): no papel elas escurecem sozinhas
export const MEDIA_STYLE = {
  movie: { label: "Filme", color: "var(--color-movie)" },
  series: { label: "Série", color: "var(--color-series)" },
  album: { label: "Álbum", color: "var(--color-album)" },
} as const;

/** Os verbos de cada mídia: um álbum se ouve; filmes e séries se veem. */
export function verbs(type: keyof typeof MEDIA_STYLE) {
  const album = type === "album";
  return {
    seen: album ? "Já ouvi" : "Já vi",
    want: album ? "Quero ouvir" : "Quero ver",
    seenOn: album ? "Você ouviu em" : "Você viu em",
    seenAlready: album ? "Você já ouviu este álbum" : "Você já viu este título",
  };
}

/** Nome de cada serviço de música, na ordem em que a API manda. */
export const SERVICE_LABEL: Record<string, string> = {
  spotify: "Spotify",
  deezer: "Deezer",
  apple_music: "Apple Music",
  youtube_music: "YouTube Music",
  youtube: "YouTube",
  tidal: "Tidal",
  bandcamp: "Bandcamp",
  soundcloud: "SoundCloud",
};

/** Cada gênero ou pessoa tem sempre a mesma cor. */
export function colorFor(text: string): string {
  const sum = [...text].reduce((total, char) => total + char.charCodeAt(0), 0);
  return COLORS[sum % COLORS.length];
}

/** "1h30", "2h", "45 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
