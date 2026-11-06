// Tipos escritos a partir de docs/API.md.
// Para tipos 100% fiéis ao contrato, rode `npm run gen:types` (openapi-typescript).
// Campos cujo formato exato o guia não detalha estão marcados como opcionais.

export type MediaType = "movie" | "series";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  ab_group: "A" | "B";
  onboarded: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface Media {
  id: number;
  type: MediaType;
  source: string;
  external_id: string;
  title: string;
  year: number | null;
  overview: string | null;
  poster_url: string | null;
  genres: string[];
  tags: string[];
  creators: string[];
  popularity: number;
}

export interface MediaPage {
  items: Media[];
  total: number;
}

export interface Review {
  id?: number;
  user_name?: string;
  rating?: number | null;
  review?: string | null;
  consumed_at?: string | null;
}

// Status do título para o usuário logado (ex.: "seen", "want"). Formato exato definido pela API.
export type MyStatus = string | null | { [key: string]: unknown };

export interface MediaDetail extends Media {
  average_rating?: number | null;
  ratings_count?: number;
  reviews?: Review[];
  my_status?: MyStatus;
}

export interface DiaryEntry {
  id: number;
  media_id?: number;
  media?: Media;
  rating: number | null;
  review: string | null;
  consumed_at: string | null;
}

export interface DiaryInput {
  media_id: number;
  rating?: number | null;
  review?: string | null;
  consumed_at?: string | null;
}

export interface MediaList {
  id: number;
  name: string;
  is_watchlist?: boolean;
  items?: Media[];
}

export interface Preferences {
  genres: string[];
  liked_media_ids?: number[];
}

export interface Recommendation {
  media: Media;
  score: number;
  reason: string;
  strategy: string;
}

export interface RecommendationsResponse {
  variant: string;
  strategy: string;
  items: Recommendation[];
}

export type FeedbackAction = "want" | "seen" | "dismiss";

export interface MediaQuery {
  q?: string;
  type?: MediaType | "";
  genre?: string;
  sort?: "popularity" | "title" | "year";
  limit?: number;
  offset?: number;
}
