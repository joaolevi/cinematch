import type {
  AdminReview,
  DiaryEntry,
  ExternalTitle,
  Feed,
  FeedbackAction,
  Media,
  MediaDetail,
  MediaInput,
  MediaType,
  Metrics,
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

type Query = Record<string, string | number | boolean | undefined | null>;

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
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
    throw new ApiError(0, "Não foi possível conectar à API. O backend está rodando?");
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
  getPreferences: () => request<{ genres: string[]; onboarded: boolean }>("/me/preferences"),
  setPreferences: (genres: string[], liked_media_ids: number[]) =>
    request<{ genres: string[]; onboarded: boolean }>("/me/preferences", {
      method: "PUT",
      body: { genres, liked_media_ids },
    }),

  // Mídias
  genres: () => request<string[]>("/media/genres"),
  search: (query: { q?: string; type?: MediaType | ""; genre?: string; limit?: number; offset?: number }) =>
    request<{ items: Media[]; total: number }>("/media", { query }),
  trending: (type?: MediaType, limit = 20) =>
    request<Media[]>("/media/trending", { query: { type, limit } }),
  media: (id: number) => request<MediaDetail>(`/media/${id}`),

  // Diário
  diary: () => request<DiaryEntry[]>("/diary"),
  addDiary: (media_id: number, rating?: number | null, review?: string, consumed_at?: string) =>
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
  feed: (type?: MediaType, limit = 20) => request<Feed>("/recommendations", { query: { type, limit } }),
  feedback: (media_id: number, action: FeedbackAction, rating?: number | null, review?: string) =>
    request<{ ok: boolean }>(`/recommendations/${media_id}/feedback`, {
      method: "POST",
      body: { action, rating: rating ?? null, review: review || null },
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
};
