// Tipos escritos a partir de docs/API.md.
// Para tipos 100% fiéis ao contrato, rode `npm run gen:types` (openapi-typescript).
// Formatos de MediaDetail, MyStatus, DiaryEntry e MediaList conferidos com docs/openapi.json.

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

// Status do título para o usuário logado (schema MyStatus do openapi.json).
export interface MyStatus {
  diary_entry_id?: number | null;
  rating?: number | null;
  in_watchlist?: boolean;
  dismissed?: boolean;
  list_ids?: number[];
}

export interface MediaDetail extends Media {
  avg_rating?: number | null; // no contrato é "avg_rating", não "average_rating"
  ratings_count?: number;
  reviews?: Review[];
  my_status?: MyStatus | null;
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

// Cada item de lista vem embrulhado: { media, added_at } (schema ListItemOut).
export interface ListItem {
  media: Media;
  added_at?: string;
}

export interface MediaList {
  id: number;
  name: string;
  is_watchlist?: boolean;
  items?: ListItem[];
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