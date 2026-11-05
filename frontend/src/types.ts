export type MediaType = "movie" | "series";
export type FeedbackAction = "want" | "seen" | "dismiss";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  ab_group: "A" | "B";
  onboarded: boolean;
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
  avg_rating: number | null;
  ratings_count: number;
  reviews: Review[];
  my_status: {
    diary_entry_id: number | null;
    rating: number | null;
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

export interface Metrics {
  overall: VariantMetrics;
  by_variant: VariantMetrics[];
  catalog_size: number;
  users: number;
  diary_entries: number;
}

export type MediaInput = Pick<
  Media,
  "type" | "title" | "year" | "overview" | "genres" | "tags" | "creators" | "popularity"
>;
