import type {
  AdminReview,
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
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
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

type Preferences = { genres: string[]; decades: number[]; creators: string[] };

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
  register: (name: string, email: string, password: string) =>
    request<TokenOut>("/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email: string, password: string) =>
    request<TokenOut>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request<User>("/me"),
  getPreferences: () => request<Preferences & { onboarded: boolean }>("/me/preferences"),
  setPreferences: (preferences: Preferences & { liked_media_ids: number[] }) =>
    request<Preferences & { onboarded: boolean }>("/me/preferences", { method: "PUT", body: preferences }),

  // Mídias
  genres: () => request<string[]>("/media/genres"),
  facets: (genre: string[]) => request<{ decades: number[]; creators: string[] }>("/media/facets", { query: { genre } }),
  search: (query: { q?: string; type?: MediaType | ""; genre?: string; person?: string; sort?: MediaSort; limit?: number; offset?: number }) =>
    request<{ items: Media[]; total: number }>("/media", { query }),
  similar: (id: number) => request<Media[]>(`/media/${id}/similar`),
  trending: (type?: MediaType, limit = 20) =>
    request<Media[]>("/media/trending", { query: { type, limit } }),
  media: (id: number) => request<MediaDetail>(`/media/${id}`),

  // Diário
  diary: () => request<DiaryEntry[]>("/diary"),
  addDiary: (media_id: number, rating?: number | null, review?: string, consumed_at?: string | null) =>
    request<DiaryEntry>("/diary", {
      method: "POST",
      body: { media_id, rating: rating ?? null, review: review || null, consumed_at: consumed_at || null },
    }),
  updateDiary: (id: number, data: { rating?: number | null; review?: string | null; consumed_at?: string | null }) =>
    request<DiaryEntry>(`/diary/${id}`, { method: "PATCH", body: data }),
  deleteDiary: (id: number) => request<void>(`/diary/${id}`, { method: "DELETE" }),

  // Listas
  lists: () => request<UserList[]>("/lists"),
  createList: (name: string) => request<UserList>("/lists", { method: "POST", body: { name } }),
  renameList: (id: number, name: string) =>
    request<UserList>(`/lists/${id}`, { method: "PATCH", body: { name } }),
  deleteList: (id: number) => request<void>(`/lists/${id}`, { method: "DELETE" }),
  addToList: (id: number, media_id: number) =>
    request<UserList>(`/lists/${id}/items`, { method: "POST", body: { media_id } }),
  removeFromList: (id: number, media_id: number) =>
    request<void>(`/lists/${id}/items/${media_id}`, { method: "DELETE" }),

  // Recomendações
  feed: (type?: MediaType, limit = 20, exclude: number[] = []) =>
    request<Feed>("/recommendations", { query: { type, limit, exclude: exclude.map(String) } }),
  undoDismiss: (media_id: number) => request<void>(`/recommendations/${media_id}/feedback`, { method: "DELETE" }),
  community: (limit: number, before_id?: number) =>
    request<{ items: CommunityEntry[] }>("/community", { query: { limit, before_id } }),
  reviewers: () => request<Reviewer[]>("/community/reviewers"),
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
  adminMetrics: () => request<Metrics>("/admin/metrics"),
  adminUsers: (query: { q?: string; kind?: "real" | "simulated" | "all"; limit?: number }) =>
    request<{ items: AdminUser[]; total: number }>("/admin/users", { query }),
  adminDeleteUser: (id: number) => request<void>(`/admin/users/${id}`, { method: "DELETE" }),
};
