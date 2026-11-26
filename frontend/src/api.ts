import type {
  Discovery,
  Provider,
  Profile,
  Connection,
  AdminComment,
  AdminReview,
  Activity,
  ActivityFilter,
  Challenge,
  Comment,
  Pair,
  SuggestedPerson,
  AdminUser,
  CommunityEntry,
  DiaryEntry,
  ExternalTitle,
  Feed,
  FeedbackAction,
  Media,
  MediaDetail,
  MediaInput,
  MediaSort,
  MediaType,
  Metrics,
  Recommendation,
  Reviewer,
  SyncResult,
  User,
  UserList,
  Person,
  AdjustKind,
  Mood,
  Moment,
  TasteProfile,
  Occasion,
  Wish,
  Episode,
  EpisodeDetail,
  Listening,
  Member,
  Mix,
  Top,
  Trailer,
  Watching,
  AdminReport,
  ReportReason,
  FoundPerson,
  PartMark,
  Track,
  TrackDetail,
  Showcase,
  LetterboxdResult,
  Arrival,
  StreamingService,
  Visibility,
  WatchlistNow,
} from "./types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "tastory.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* armazenamento indisponível: sessão só em memória */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Preferences = { genres: string[]; decades: number[]; creators: string[]; artists?: string[] };

type Query = Record<string, string | string[] | number | boolean | undefined | null>;

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não conseguimos falar com o servidor. Tente de novo em instantes.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d: { msg: string }) => d.msg).join("; ")
      : data.detail;
    throw new ApiError(res.status, detail ?? `Erro ${res.status}`);
  }
  return data as T;
}

interface TokenOut {
  access_token: string;
  user: User;
}

export const api = {
  // Acesso
  register: (name: string, email: string, password: string, in_experiments: boolean) =>
    request<TokenOut>("/auth/register", { method: "POST", body: { name, email, password, in_experiments } }),
  login: (email: string, password: string) =>
    request<TokenOut>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request<User>("/me"),
  getPreferences: () => request<Preferences & { onboarded: boolean }>("/me/preferences"),
  setPreferences: (preferences: Preferences & { liked_media_ids: number[] }) =>
    request<Preferences & { onboarded: boolean }>("/me/preferences", { method: "PUT", body: preferences }),

  // Mídias
  genres: (type?: MediaType) => request<string[]>("/media/genres", { query: { type } }),
  facets: (genre: string[], type?: MediaType, limit?: number) =>
    request<{ decades: number[]; creators: string[] }>("/media/facets", { query: { genre, type, limit } }),
  search: (query: { q?: string; type?: MediaType | ""; genre?: string; person?: string; mood?: string; decade?: number; sort?: MediaSort; limit?: number; offset?: number }) =>
    request<{ items: Media[]; total: number }>("/media", { query }),
  similar: (id: number) => request<Media[]>(`/media/${id}/similar`),
  connections: (id: number) => request<Connection[]>(`/media/${id}/connections`),
  providers: (id: number) => request<Provider[]>(`/media/${id}/providers`),
  trending: (type?: MediaType, limit = 20) =>
    request<Media[]>("/media/trending", { query: { type, limit } }),
  showcase: () => request<Showcase>("/media/showcase"),
  setFavorites: (media_ids: number[]) => request<Media[]>("/me/favorites", { method: "PUT", body: { media_ids } }),
  episodes: (mediaId: number, season: number) => request<Episode[]>(`/media/${mediaId}/seasons/${season}/episodes`),
  episode: (mediaId: number, season: number, episode: number) =>
    request<EpisodeDetail>(`/media/${mediaId}/seasons/${season}/episodes/${episode}`),
  rateEpisode: (mediaId: number, season: number, episode: number, data: Partial<PartMark>) =>
    request<PartMark>(`/media/${mediaId}/seasons/${season}/episodes/${episode}`, { method: "PUT", body: data }),
  markSeason: (mediaId: number, season: number) =>
    request<Episode[]>(`/media/${mediaId}/seasons/${season}/seen`, { method: "POST" }),
  tracks: (mediaId: number) => request<Track[]>(`/media/${mediaId}/tracks`),
  track: (mediaId: number, disc: number, number: number) =>
    request<TrackDetail>(`/media/${mediaId}/tracks/${disc}/${number}`),
  rateTrack: (mediaId: number, disc: number, number: number, data: Partial<PartMark>) =>
    request<PartMark>(`/media/${mediaId}/tracks/${disc}/${number}`, { method: "PUT", body: data }),
  continueWatching: () => request<Watching[]>("/me/watching"),
  continueListening: () => request<Listening[]>("/me/listening"),
  top: (type?: MediaType) => request<Top>("/media/top", { query: { type } }),
  trailer: (mediaId: number) => request<Trailer>(`/media/${mediaId}/trailer`),
  mixes: () => request<Mix[]>("/recommendations/mixes"),
  report: (entryId: number, reason: ReportReason, note?: string) =>
    request<{ reported: boolean; spoiler: boolean }>(`/community/${entryId}/report`, { method: "POST", body: { reason, note } }),
  adminReports: () => request<AdminReport[]>("/admin/reports"),
  adminDecideReport: (entryId: number, action: "spoiler" | "not_spoiler" | "hide" | "dismiss") =>
    request<void>(`/admin/reports/${entryId}`, { method: "PATCH", body: { action } }),
  popularPeople: (period: "semana" | "mes" | "sempre", limit = 30) =>
    request<Member[]>("/users/popular", { query: { period, limit } }),
  personReviews: (userId: number, sort: "recentes" | "populares", limit = 20, offset = 0) =>
    request<CommunityEntry[]>(`/users/${userId}/reviews`, { query: { sort, limit, offset } }),
  searchPeople: (q: string, limit = 8) => request<FoundPerson[]>("/users/search", { query: { q, limit } }),
  avatars: () => request<Record<string, string>>("/users/avatars"),
  setAvatar: (image: string) => request<void>("/me/avatar", { method: "PUT", body: { image } }),
  removeAvatar: () => request<void>("/me/avatar", { method: "DELETE" }),
  editAccount: (data: { name?: string; email?: string }) => request<User>("/me", { method: "PATCH", body: data }),
  changePassword: (current_password: string, new_password: string) =>
    request<void>("/me/password", { method: "PUT", body: { current_password, new_password } }),
  media: (id: number) => request<MediaDetail>(`/media/${id}`),

  // Diário
  diary: () => request<DiaryEntry[]>("/diary"),
  addDiary: (media_id: number, rating?: number | null, review?: string, consumed_at?: string | null) =>
    request<DiaryEntry>("/diary", {
      method: "POST",
      body: { media_id, rating: rating ?? null, review: review || null, consumed_at: consumed_at || null },
    }),
  watching: (media_id: number, season: number | null) =>
    request<DiaryEntry>("/diary", { method: "POST", body: { media_id, status: "watching", season } }),
  updateDiary: (
    id: number,
    data: { rating?: number | null; review?: string | null; consumed_at?: string | null; excluded?: boolean; season?: number; spoiler?: boolean },
  ) =>
    request<DiaryEntry>(`/diary/${id}`, { method: "PATCH", body: data }),
  deleteDiary: (id: number) => request<void>(`/diary/${id}`, { method: "DELETE" }),

  // Listas
  lists: () => request<UserList[]>("/lists"),
  featured: () => request<UserList[]>("/lists/featured"),
  createList: (name: string) => request<UserList>("/lists", { method: "POST", body: { name } }),
  renameList: (id: number, name: string) =>
    request<UserList>(`/lists/${id}`, { method: "PATCH", body: { name } }),
  deleteList: (id: number) => request<void>(`/lists/${id}`, { method: "DELETE" }),
  addToList: (id: number, media_id: number) =>
    request<UserList>(`/lists/${id}/items`, { method: "POST", body: { media_id } }),
  removeFromList: (id: number, media_id: number) =>
    request<void>(`/lists/${id}/items/${media_id}`, { method: "DELETE" }),

  // Recomendações
  feed: (type?: MediaType, limit = 20, exclude: number[] = [], discovery: Discovery = "taste", moment: Moment = {}) =>
    request<Feed>("/recommendations", { query: { type, limit, exclude: exclude.map(String), discovery, ...moment } }),
  moods: () => request<Mood[]>("/media/moods"),
  occasions: () => request<Occasion[]>("/media/occasions"),
  understand: (q: string) => request<Wish>("/recommendations/understand", { query: { q } }),
  services: () => request<StreamingService[]>("/media/services"),
  setServices: (services: string[]) => request<User>("/me/services", { method: "PUT", body: { services } }),
  setVisibility: (visibility: Visibility) => request<User>("/me/visibility", { method: "PUT", body: { visibility } }),
  watchlistNow: (moment: Moment = {}) => request<WatchlistNow>("/recommendations/watchlist", { query: { ...moment } }),
  externalSearch: (q: string, type: "video" | "album") => request<ExternalTitle[]>("/external/search", { query: { q, type } }),
  externalImport: (external_id: string) => request<Media>("/external/import", { method: "POST", body: { external_id } }),
  taste: () => request<TasteProfile>("/me/taste"),
  adjust: (kind: AdjustKind, value: string, weight: number) =>
    request<void>("/me/taste/adjustments", { method: "PUT", body: { kind, value, weight } }),
  resetTaste: () => request<void>("/me/taste/adjustments", { method: "DELETE" }),
  undoDismiss: (media_id: number) => request<void>(`/recommendations/${media_id}/feedback`, { method: "DELETE" }),
  community: (limit: number, before_id?: number, following = false) =>
    request<{ items: CommunityEntry[] }>("/community", { query: { limit, before_id, following: following || undefined } }),
  following: () => request<Person[]>("/users/following"),
  exportMyData: () => request<unknown>("/me/export"),
  arrivals: () => request<Arrival[]>("/me/watchlist/arrivals"),
  importLetterboxd: (files: { name: string; content: string }[]) =>
    request<LetterboxdResult>("/me/import/letterboxd", { method: "POST", body: { files } }),
  deleteMyAccount: (password: string) => request<void>("/me", { method: "DELETE", body: { password } }),
  setExperiments: (in_experiments: boolean) => request<User>("/me/experiments", { method: "PUT", body: { in_experiments } }),
  follow: (id: number) => request<void>(`/users/${id}/follow`, { method: "PUT" }),
  unfollow: (id: number) => request<void>(`/users/${id}/follow`, { method: "DELETE" }),
  reviewers: () => request<Reviewer[]>("/community/reviewers"),
  profile: (id: number) => request<Profile>(`/users/${id}`),
  personDiary: (id: number) => request<DiaryEntry[]>(`/users/${id}/diary`),
  together: (id: number, limit = 12) => request<Recommendation[]>(`/users/${id}/together`, { query: { limit } }),
  togetherNow: (people: number[], moment: Moment = {}, limit = 20) =>
    request<Recommendation[]>("/recommendations/together", { query: { with: people.map(String), limit, ...moment } }),
  pairs: (exclude: number[], moment: Moment = {}, limit = 3) =>
    request<Pair[]>("/recommendations/pairs", { query: { exclude: exclude.map(String), limit, ...moment } }),
  suggestions: () => request<SuggestedPerson[]>("/users/suggestions"),
  activity: (kind?: ActivityFilter, limit = 50, offset = 0) =>
    request<Activity[]>("/me/activity", { query: { kind, limit, offset } }),
  challenge: () => request<Challenge | null>("/lists/featured/challenge"),
  followers: (id: number) => request<Person[]>(`/users/${id}/followers`),
  follows: (id: number) => request<Person[]>(`/users/${id}/follows`),
  like: (entry: number) => request<void>(`/community/${entry}/like`, { method: "PUT" }),
  unlike: (entry: number) => request<void>(`/community/${entry}/like`, { method: "DELETE" }),
  comments: (entry: number) => request<Comment[]>(`/community/${entry}/comments`),
  addComment: (entry: number, text: string) =>
    request<Comment>(`/community/${entry}/comments`, { method: "POST", body: { text } }),
  deleteComment: (id: number) => request<void>(`/community/comments/${id}`, { method: "DELETE" }),
  impressions: (items: Recommendation[]) =>
    request<void>("/recommendations/impressions", {
      method: "POST",
      body: { items: items.map((i) => ({ media_id: i.media.id, strategy: i.strategy, score: i.score })) },
    }),
  feedback: (media_id: number, action: FeedbackAction, rating?: number | null, review?: string, consumed_at?: string | null) =>
    request<{ ok: boolean }>(`/recommendations/${media_id}/feedback`, {
      method: "POST",
      body: { action, rating: rating ?? null, review: review || null, consumed_at: consumed_at || null },
    }),

  // Administração
  adminCreateMedia: (data: MediaInput) => request<Media>("/admin/media", { method: "POST", body: data }),
  adminUpdateMedia: (id: number, data: Partial<MediaInput>) =>
    request<Media>(`/admin/media/${id}`, { method: "PATCH", body: data }),
  adminDeleteMedia: (id: number) => request<void>(`/admin/media/${id}`, { method: "DELETE" }),
  adminSync: (provider: "auto" | "tmdb" | "mock" = "auto", pages?: number) =>
    request<SyncResult>("/admin/sync", { method: "POST", query: { provider, pages } }),
  tmdbSearch: (q: string, type?: MediaType) =>
    request<ExternalTitle[]>("/admin/tmdb/search", { query: { q, type } }),
  tmdbImport: (type: MediaType, tmdb_id: number) =>
    request<{ media: Media; result: SyncResult }>("/admin/tmdb/import", {
      method: "POST",
      body: { type, tmdb_id },
    }),
  adminReviews: () => request<AdminReview[]>("/admin/reviews"),
  adminModerate: (id: number, hidden: boolean) =>
    request<AdminReview>(`/admin/reviews/${id}`, { method: "PATCH", body: { hidden } }),
  adminComments: () => request<AdminComment[]>("/admin/comments"),
  adminModerateComment: (id: number, hidden: boolean) =>
    request<AdminComment>(`/admin/comments/${id}`, { method: "PATCH", body: { hidden } }),
  adminMetrics: () => request<Metrics>("/admin/metrics"),
  adminUsers: (query: { q?: string; kind?: "real" | "simulated" | "all"; limit?: number }) =>
    request<{ items: AdminUser[]; total: number }>("/admin/users", { query }),
  adminDeleteUser: (id: number) => request<void>(`/admin/users/${id}`, { method: "DELETE" }),
};
