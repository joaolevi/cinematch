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
  backdrop_url?: string | null;
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
  kind: "soundtrack" | "composer" | "same_person" | "biopic" | "documentary" | "artist" | "weak";
  weight: number;
  reason: string;
}

export interface Review {
  id: number;
  spoiler?: boolean;
  following?: boolean;
  user_id?: number | null;
  likes: number;
  liked: boolean;
  comments: number;
  user_name: string;
  rating: number | null;
  review: string;
  consumed_at: string | null;
  created_at: string;
  /** Se quem vê já denunciou a resenha */
  reported?: boolean;
}

export type ReportReason = "spoiler" | "ofensa" | "spam" | "outro";

/** Uma resenha com denúncias abertas, na moderação */
export interface AdminReport {
  entry_id: number;
  media_id: number;
  media_title: string;
  user_name: string;
  review: string;
  spoiler: boolean;
  review_hidden: boolean;
  reports: number;
  reasons: Partial<Record<ReportReason, number>>;
  notes: string[];
  last_at: string;
}

/** Alguém encontrado pelo nome na busca de pessoas */
export interface FoundPerson {
  id: number;
  name: string;
  followers: number;
  /** Vazio quando o diário é só para quem segue */
  titles: number | null;
  following: boolean;
}

/** O que a pessoa marcou num episódio ou numa faixa: visto (ou ouvido), nota e anotação */
export interface PartMark {
  seen: boolean;
  rating: number | null;
  note: string | null;
}

/** Um episódio, com o que quem vê marcou (RFF24) */
export interface Episode extends PartMark {
  number: number;
  name: string | null;
  air_date: string | null;
  overview: string | null;
  still_url?: string | null;
  runtime?: number | null;
  directors?: string[];
}

/** A página do episódio: a série, os vizinhos e o que todo mundo achou */
export interface EpisodeDetail extends Episode {
  season: number;
  series: Media;
  previous: { season: number; number: number; name: string | null } | null;
  next: { season: number; number: number; name: string | null } | null;
  seen_by: number;
  ratings: number;
  average: number | null;
}

/** Uma faixa do álbum, com o que quem ouve marcou */
export interface Track extends PartMark {
  disc: number;
  number: number;
  title: string;
  length_sec: number | null;
  artists: string[];
}

export interface TrackDetail extends Track {
  album: Media;
  position: number;
  total: number;
  discs: number;
  previous: { disc: number; number: number; title: string } | null;
  next: { disc: number; number: number; title: string } | null;
  seen_by: number;
  ratings: number;
  average: number | null;
}

/** Temporada de uma série (RFF24) */
export interface Season {
  number: number;
  name: string | null;
  episodes: number | null;
  year: number | null;
}

export type Progress = "seen" | "watching";

export interface MediaDetail extends Media {
  actors: string[];
  histogram: number[];
  friends: { id: number; name: string; rating: number | null; status: Progress }[];
  seasons: Season[];
  credit: Credit | null;
  avg_rating: number | null;
  ratings_count: number;
  reviews: Review[];
  my_status: {
    diary_entry_id: number | null;
    rating: number | null;
  consumed_at: string | null;
    status: Progress | null;
    season: number | null;
    episodes?: Record<string, number>;
    spoiler?: boolean;
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
  status?: Progress;
  season?: number | null;
  spoiler?: boolean;
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
  /** Todos os serviços de assinatura onde o título está, com o logo (RFF19) */
  streaming?: { key: string; label: string; logo: string | null }[];
}

/** Alguém para seguir, pelo gosto parecido (RFF15) */
export interface SuggestedPerson {
  id: number;
  name: string;
  percent: number;
  label: string;
}

/** Uma linha do histórico de atividades (RFF31) */
export interface Activity {
  kind: "registro" | "lista" | "curtida" | "comentario" | "seguiu";
  at: string;
  media: Media | null;
  rating: number | null;
  text: string | null;
  list_name: string | null;
  person: Person | null;
}

export type ActivityFilter = "registros" | "notas" | "resenhas" | "listas" | "curtidas" | "comentarios" | "seguindo";

/** Selo e desafio do tema do mês (RFF32) */
export interface Badge {
  badge: string;
  title: string;
  month: string;
}

export interface Challenge {
  month: string;
  title: string;
  goal: number;
  badge: string;
  done: Media[];
  earned: boolean;
  description?: string | null;
  next: Media[];
}

/** Sessão dupla (RFF27): um filme ou série para ver e um disco para ouvir depois */
export interface Pair {
  video: Recommendation;
  album: Media;
  kind: "soundtrack" | "composer" | "same_person" | "biopic" | "documentary";
  reason: string;
}

/** Exemplos da apresentação, antes de entrar: pares de filme e disco e os álbuns mais ouvidos */
export interface Showcase {
  pairs: { video: Media; album: Media; kind: Pair["kind"]; reason: string }[];
  albums: Media[];
}

/** EXP03: aceitação dos discos sugeridos por ponte, por tipo de ponte */
export interface BridgeMetrics {
  kind: string;
  label: string;
  shown: number;
  accepted: number;
  acceptance_rate: number;
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

/** Um título do Quero ver que chegou a um serviço da pessoa (RFF29) */
export interface Arrival {
  media: Media;
  service: { key: string; label: string; logo: string | null };
  since: string;
}

/** Resultado da importação do Letterboxd (RFF18) */
export interface LetterboxdResult {
  registered: number;
  want_to_watch: number;
  already_in_diary: number;
  brought: number;
  next_time: number;
  not_found: string[];
  not_found_total: number;
  ignored_files: string[];
}

/** Pedido em português (RFF25): os filtros que o texto escolheu */
export interface Wish {
  type: MediaType | null;
  mood: string | null;
  max_minutes: number | null;
  occasion: string | null;
  discovery: "beyond" | "outside" | null;
  only_mine: boolean;
  understood: { text: string; labels: string[] }[];
  ignored: string[];
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
  status?: Progress;
  season?: number | null;
  spoiler?: boolean;
  /** Curtidas e comentários na resenha (RFF30) */
  likes: number;
  liked: boolean;
  comments: number;
  /** Se quem vê já denunciou a resenha */
  reported?: boolean;
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
  pinned: Media[];
  counts: { movie: number; series: number; album: number };
  favorites: { media: Media; rating: number | null }[];
  recent: { media: Media; rating: number | null }[];
  compatibility: { percent: number | null; label: string; shared: Media[]; genres: string[] } | null;
  following: boolean;
  followers: number;
  follows: number;
  /** Os registros são só para quem segue a pessoa, e quem vê ainda não segue (RFF10) */
  restricted: boolean;
  /** Selos dos desafios do tema do mês (RFF32) */
  badges: Badge[];
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
  by_bridge: BridgeMetrics[];
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
