export type MediaType = "movie" | "series" | "album";
export type FeedbackAction = "want" | "seen" | "dismiss";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  ab_group: "A" | "B";
  onboarded: boolean;
  in_experiments: boolean;
  /** Quem vê os registros (RFF10): todos, quem segue ou só a pessoa */
  visibility: Visibility;
  /** Serviços que a pessoa assina (RFF21), como "netflix" */
  services: string[];
}

export type Visibility = "all" | "followers" | "private";

export type MediaSort = "popularity" | "title" | "year";

/** Onde ouvir um álbum. Com level "artist", o link leva à página do artista, porque o disco não tem link próprio. */
export interface ListenLink {
  service: string;
  url: string;
  level: "album" | "artist";
}

export interface Media {
  id: number;
  type: MediaType;
  source: string;
  external_id: string | null;
  title: string;
  year: number | null;
  overview: string;
  poster_url: string | null;
  genres: string[];
  tags: string[];
  creators: string[];
  popularity: number;
  duration_min?: number | null;
  moods?: string[];
  countries?: string[];
  language?: string | null;
  links?: ListenLink[];
}

/** Onde assistir no Brasil, com dados da JustWatch pelo TMDB. */
export interface Provider {
  service: string;
  kind: "flatrate" | "rent" | "buy";
  logo: string | null;
  link: string | null;
}

/** Um título da outra mídia ligado a este por uma ponte: "Para ouvir depois" ou "Para ver depois". */
export interface Connection {
  media: Media;
  kind: "soundtrack" | "composer" | "same_person" | "artist" | "weak";
  weight: number;
  reason: string;
}

export interface Review {
  id: number;
  user_name: string;
  rating: number | null;
  review: string;
  consumed_at: string | null;
  created_at: string;
}

export interface MediaDetail extends Media {
  actors: string[];
  credit: Credit | null;
  avg_rating: number | null;
  ratings_count: number;
  reviews: Review[];
  my_status: {
    diary_entry_id: number | null;
    rating: number | null;
  consumed_at: string | null;
    in_watchlist: boolean;
    dismissed: boolean;
    list_ids: number[];
  };
}

export interface DiaryEntry {
  id: number;
  media: Media;
  rating: number | null;
  review: string | null;
  review_hidden: boolean;
  consumed_at: string | null;
  from_onboarding: boolean;
  created_at: string;
  excluded?: boolean;
}

export interface UserList {
  id: number;
  name: string;
  is_watchlist: boolean;
  featured?: boolean;
  description?: string | null;
  created_at: string;
  items: { media: Media; added_at: string }[];
}

export interface Recommendation {
  media: Media;
  score: number;
  reason: string;
  strategy: "hybrid" | "content" | "trending" | "bridge" | "discovery" | "watchlist";
  /** O que está por trás do motivo, para o "Não por esse motivo" (RFF08) */
  because?: Because | null;
  /** Os serviços da pessoa onde o título está (RFF21), como ["Netflix"] */
  services?: string[];
}

/** O Quero ver ordenado pelo que combina agora (RFF22) */
export interface WatchlistNow {
  items: Recommendation[];
  later: Recommendation[];
}

export interface StreamingService {
  key: string;
  label: string;
  count: number;
}

export interface Occasion {
  key: string;
  label: string;
}

/** De onde vêm os dados do título (RNFF02) */
export interface Credit {
  name: string;
  url: string | null;
  license: string;
}

export type AdjustKind = "genre" | "decade" | "person" | "mood" | "title";

export interface Because {
  kind: AdjustKind;
  value: string;
  label: string;
}

/** Um clima do vocabulário (RNFF09), como "leve" */
export interface Mood {
  key: string;
  label: string;
  count: number;
}

/** Filtros do momento (RFF20) */
export interface Moment {
  mood?: string;
  max_minutes?: number;
  occasion?: string;
  /** Só o que está nos serviços da pessoa (RFF21) */
  only_mine?: boolean;
}

export interface TasteFacet {
  kind: Exclude<AdjustKind, "title">;
  value: string;
  label: string;
  share: number;
  weight: number;
}

export interface TasteProfile {
  genres: TasteFacet[];
  decades: TasteFacet[];
  people: TasteFacet[];
  moods: TasteFacet[];
  titles: { media: Media; signal: number; entry_id: number | null; rating: number | null; weight: number }[];
  excluded: { entry_id: number; media: Media }[];
  adjusted: number;
}

/** Modo descoberta (RFF16): no meu gosto, um pouco além ou fora da sua bolha. */
export type Discovery = "taste" | "beyond" | "outside";

export interface Feed {
  variant: "A" | "B" | "-";
  strategy: Exclude<Recommendation["strategy"], "watchlist">;
  items: Recommendation[];
}

export interface CommunityEntry {
  id: number;
  user_id: number;
  user_name: string;
  media: Media;
  rating: number | null;
  review: string | null;
  consumed_at: string | null;
  created_at: string;
  /** Curtidas e comentários na resenha (RFF30) */
  likes: number;
  liked: boolean;
  comments: number;
}

export interface Comment {
  id: number;
  user_id: number;
  user_name: string;
  text: string;
  created_at: string;
  /** Quem escreveu o comentário ou a resenha pode apagar */
  can_delete: boolean;
}

export interface AdminComment {
  id: number;
  user_name: string;
  user_email: string;
  entry_id: number;
  review_author: string;
  media_title: string;
  text: string;
  hidden: boolean;
  created_at: string;
}

export interface Profile {
  id: number;
  name: string;
  is_me: boolean;
  counts: { movie: number; series: number; album: number };
  favorites: { media: Media; rating: number | null }[];
  recent: { media: Media; rating: number | null }[];
  compatibility: { percent: number | null; label: string; shared: Media[]; genres: string[] } | null;
  following: boolean;
  followers: number;
  follows: number;
  /** Os registros são só para quem segue a pessoa, e quem vê ainda não segue (RFF10) */
  restricted: boolean;
}

export interface Person {
  id: number;
  name: string;
}

export interface Reviewer {
  id: number;
  name: string;
  titles: number;
  reviews: number;
  /** Curtidas recebidas nas resenhas, que ordenam o rank (RFF30) */
  likes: number;
}

export interface AdminReview {
  id: number;
  user_name: string;
  user_email: string;
  media_id: number;
  media_title: string;
  rating: number | null;
  review: string;
  review_hidden: boolean;
  created_at: string;
}

export interface VariantMetrics {
  variant: string;
  users: number;
  shown: number;
  want: number;
  seen: number;
  dismiss: number;
  acceptance_rate: number;
  rated: number;
  satisfied: number;
  satisfaction_rate: number | null;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  ab_group: "A" | "B";
  is_synthetic: boolean;
  onboarded: boolean;
  created_at: string;
  diary_entries: number;
  reviews: number;
  shown: number;
  accepted: number;
  last_active: string;
}

export interface Metrics {
  overall: VariantMetrics;
  by_variant: VariantMetrics[];
  catalog_size: number;
  users: number;
  diary_entries: number;
  real_users: number;
  simulated_shown: number;
  trending_shown: number;
  movies: number;
  series: number;
  albums: number;
  external_neighbors_enabled: boolean;
  titles_with_neighbors: number;
  acceptance_window_days: number;
  opted_out: number;
}

export type MediaInput = Pick<
  Media,
  "type" | "title" | "year" | "overview" | "genres" | "tags" | "creators" | "popularity"
>;

export interface SyncResult {
  provider: string;
  fetched: number;
  created: number;
  updated: number;
  merged: number;
  skipped: number;
}

export interface ExternalTitle {
  external_id: string;
  type: MediaType;
  title: string;
  year: number | null;
  overview: string;
  poster_url: string | null;
  genres: string[];
  popularity: number;
  media_id: number | null;
}
