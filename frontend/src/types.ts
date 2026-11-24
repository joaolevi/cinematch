export type MediaType = "movie" | "series" | "album";
export type FeedbackAction = "want" | "seen" | "dismiss";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  ab_group: "A" | "B";
  onboarded: boolean;
}

export type MediaSort = "popularity" | "title" | "year";

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
}

export interface UserList {
  id: number;
  name: string;
  is_watchlist: boolean;
  created_at: string;
  items: { media: Media; added_at: string }[];
}

export interface Recommendation {
  media: Media;
  score: number;
  reason: string;
  strategy: "hybrid" | "content" | "trending";
}

export interface Feed {
  variant: "A" | "B";
  strategy: Recommendation["strategy"];
  items: Recommendation[];
}

export interface CommunityEntry {
  id: number;
  user_name: string;
  media: Media;
  rating: number | null;
  review: string | null;
  consumed_at: string | null;
  created_at: string;
}

export interface Reviewer {
  name: string;
  titles: number;
  reviews: number;
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
  external_neighbors_enabled: boolean;
  titles_with_neighbors: number;
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
