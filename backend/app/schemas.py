"""Schemas Pydantic de entrada e saída da API."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

MediaType = Literal["movie", "series"]
MAX_PASSWORD_BYTES = 72  # limite do bcrypt
FeedbackAction = Literal["want", "seen", "dismiss"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError(f"a senha deve ter no máximo {MAX_PASSWORD_BYTES} bytes")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    ab_group: str
    onboarded: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Preferências ----------
class PreferencesIn(BaseModel):
    genres: list[Annotated[str, Field(max_length=60)]] = []
    decades: list[Annotated[int, Field(ge=1880, le=2100)]] = []
    creators: list[Annotated[str, Field(max_length=120)]] = []
    liked_media_ids: list[int] = []


class PreferencesOut(BaseModel):
    genres: list[str]
    decades: list[int]
    creators: list[str]
    onboarded: bool


# ---------- Mídia ----------
class MediaOut(ORM):
    id: int
    type: str
    source: str
    external_id: str | None
    title: str
    year: int | None
    overview: str
    poster_url: str | None
    genres: list[str]
    tags: list[str]
    creators: list[str]
    popularity: float


class MediaIn(BaseModel):
    type: MediaType
    title: str = Field(min_length=1, max_length=255)
    year: int | None = Field(default=None, ge=1880, le=2100)
    overview: str = ""
    poster_url: str | None = Field(default=None, max_length=500)
    genres: list[str] = []
    tags: list[str] = []
    creators: list[str] = []
    popularity: float = Field(default=0, ge=0, le=100)


class MediaUpdate(BaseModel):
    type: MediaType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    year: int | None = Field(default=None, ge=1880, le=2100)
    overview: str | None = None
    poster_url: str | None = Field(default=None, max_length=500)
    genres: list[str] | None = None
    tags: list[str] | None = None
    creators: list[str] | None = None
    popularity: float | None = Field(default=None, ge=0, le=100)


class ReviewOut(BaseModel):
    id: int
    user_name: str
    rating: float | None
    review: str
    consumed_at: date | None
    created_at: datetime


class MyStatus(BaseModel):
    diary_entry_id: int | None = None
    rating: float | None = None
    in_watchlist: bool = False
    dismissed: bool = False
    list_ids: list[int] = []


class MediaDetailOut(MediaOut):
    avg_rating: float | None
    ratings_count: int
    reviews: list[ReviewOut]
    my_status: MyStatus


class MediaFacetsOut(BaseModel):
    decades: list[int]
    creators: list[str]


class MediaPage(BaseModel):
    items: list[MediaOut]
    total: int


# ---------- Diário ----------
def _check_rating(v: float | None) -> float | None:
    if v is None:
        return v
    if not (0.5 <= v <= 5.0) or (v * 2) != int(v * 2):
        raise ValueError("a nota deve ir de 0,5 a 5,0 em passos de 0,5")
    return v


class DiaryIn(BaseModel):
    media_id: int
    rating: float | None = None
    review: str | None = Field(default=None, max_length=2000)
    consumed_at: date | None = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float | None) -> float | None:
        return _check_rating(v)


class DiaryUpdate(BaseModel):
    rating: float | None = None
    review: str | None = Field(default=None, max_length=2000)
    consumed_at: date | None = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float | None) -> float | None:
        return _check_rating(v)


class DiaryOut(ORM):
    id: int
    media: MediaOut
    rating: float | None
    review: str | None
    review_hidden: bool
    consumed_at: date | None
    from_onboarding: bool
    created_at: datetime


# ---------- Listas ----------
class ListIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ListItemIn(BaseModel):
    media_id: int


class ListItemOut(ORM):
    media: MediaOut
    added_at: datetime


class ListOut(ORM):
    id: int
    name: str
    is_watchlist: bool
    created_at: datetime
    items: list[ListItemOut]


# ---------- Recomendações ----------
class RecommendationOut(BaseModel):
    media: MediaOut
    score: float
    reason: str
    strategy: str  # hybrid | content | trending


class FeedOut(BaseModel):
    variant: str
    strategy: str
    items: list[RecommendationOut]


class FeedbackIn(BaseModel):
    action: FeedbackAction
    rating: float | None = None
    review: str | None = Field(default=None, max_length=2000)

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float | None) -> float | None:
        return _check_rating(v)


# ---------- Admin ----------
class AdminReviewOut(BaseModel):
    id: int
    user_name: str
    user_email: str
    media_id: int
    media_title: str
    rating: float | None
    review: str
    review_hidden: bool
    created_at: datetime


class ReviewModerationIn(BaseModel):
    hidden: bool


class SyncOut(BaseModel):
    provider: str
    fetched: int
    created: int
    updated: int
    merged: int = 0  # títulos que já existiam (ex.: no mock) e foram promovidos para esta origem
    skipped: int = 0


class ExternalTitleOut(BaseModel):
    external_id: str
    type: str
    title: str
    year: int | None
    overview: str
    poster_url: str | None
    genres: list[str]
    popularity: float
    media_id: int | None = None  # preenchido se o título já está no catálogo


class TmdbImportIn(BaseModel):
    type: MediaType
    tmdb_id: int = Field(gt=0)


class TmdbImportOut(BaseModel):
    media: MediaOut
    result: SyncOut


class VariantMetrics(BaseModel):
    variant: str
    users: int
    shown: int
    want: int
    seen: int
    dismiss: int
    acceptance_rate: float


class MetricsOut(BaseModel):
    overall: VariantMetrics
    by_variant: list[VariantMetrics]
    catalog_size: int
    users: int
    diary_entries: int
    real_users: int
    simulated_shown: int
    movies: int
    series: int
    external_neighbors_enabled: bool
    titles_with_neighbors: int
