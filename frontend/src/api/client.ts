import type {
  AuthResponse,
  DiaryEntry,
  DiaryInput,
  FeedbackAction,
  Media,
  MediaDetail,
  MediaList,
  MediaPage,
  MediaQuery,
  MediaType,
  Preferences,
  RecommendationsResponse,
  User,
} from "./types";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "cinematch.token";

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export function setUnauthorizedHandler(fn: UnauthorizedHandler) {
  onUnauthorized = fn;
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((x) => (x && typeof x === "object" && "msg" in x ? String((x as { msg: unknown }).msg) : ""))
        .filter(Boolean)
        .join("; ") || fallback;
    }
  }
  return fallback;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Record<string, unknown>; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true } = opts;
  const url = new URL(API_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar à API. Ela está rodando em " + API_URL + "?");
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    if (res.status === 401 && auth && token) onUnauthorized();
    throw new ApiError(res.status, errorMessage(data, `Erro ${res.status}`));
  }
  return data as T;
}

export const api = {
  // Acesso
  register: (b: { name: string; email: string; password: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: b, auth: false }),
  login: (b: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: b, auth: false }),
  me: () => request<User>("/me"),
  getPreferences: () => request<Preferences>("/me/preferences"),
  savePreferences: (b: { genres: string[]; liked_media_ids: number[] }) =>
    request<unknown>("/me/preferences", { method: "PUT", body: b }),

  // Catálogo
  media: (q: MediaQuery = {}) => request<MediaPage>("/media", { query: { ...q }, auth: false }),
  genres: () => request<string[]>("/media/genres", { auth: false }),
  trending: (p: { type?: MediaType; limit?: number } = {}) =>
    request<Media[] | MediaPage>("/media/trending", { query: { ...p }, auth: false }),
  mediaDetail: (id: number) => request<MediaDetail>(`/media/${id}`),

  // Diário
  diary: () => request<DiaryEntry[]>("/diary"),
  addDiary: (b: DiaryInput) => request<DiaryEntry>("/diary", { method: "POST", body: b }),
  updateDiary: (id: number, b: Partial<Omit<DiaryInput, "media_id">>) =>
    request<DiaryEntry>(`/diary/${id}`, { method: "PATCH", body: b }),
  deleteDiary: (id: number) => request<void>(`/diary/${id}`, { method: "DELETE" }),

  // Listas
  lists: () => request<MediaList[]>("/lists"),
  createList: (name: string) => request<MediaList>("/lists", { method: "POST", body: { name } }),
  renameList: (id: number, name: string) =>
    request<MediaList>(`/lists/${id}`, { method: "PATCH", body: { name } }),
  deleteList: (id: number) => request<void>(`/lists/${id}`, { method: "DELETE" }),
  addToList: (id: number, media_id: number) =>
    request<unknown>(`/lists/${id}/items`, { method: "POST", body: { media_id } }),
  removeFromList: (id: number, media_id: number) =>
    request<void>(`/lists/${id}/items/${media_id}`, { method: "DELETE" }),

  // Recomendações
  recommendations: (p: { type?: MediaType; limit?: number } = {}) =>
    request<RecommendationsResponse>("/recommendations", { query: { ...p } }),
  feedback: (
    media_id: number,
    b: { action: FeedbackAction; rating?: number | null; review?: string | null },
  ) => request<unknown>(`/recommendations/${media_id}/feedback`, { method: "POST", body: b }),
};

/** O endpoint /media/trending pode devolver lista ou {items,total}; normaliza. */
export function asMediaArray(r: Media[] | MediaPage): Media[] {
  return Array.isArray(r) ? r : r.items;
}
