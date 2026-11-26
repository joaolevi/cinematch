"""Schemas Pydantic de entrada e saída da API."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

MediaType = Literal["movie", "series", "album"]
VideoType = Literal["movie", "series"]  # o que o TMDB importa
MAX_PASSWORD_BYTES = 72  # limite do bcrypt
FeedbackAction = Literal["want", "seen", "dismiss"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6)
    in_experiments: bool = Field(
        default=True,
        description="Consentimento para os experimentos (RNFF08). A interface pergunta no cadastro, sem marcar por "
        "padrão, e manda a escolha; sem o campo, vale True, como antes",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("o nome deve ter pelo menos 2 caracteres")
        return v

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
    in_experiments: bool = True
    visibility: Literal["all", "followers", "private"] = Field(
        default="all", description="Quem vê os registros (RFF10): todos, quem segue a pessoa ou só ela"
    )
    services: list[str] = Field(default=[], description='Serviços que a pessoa assina (RFF21), como "netflix"')


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Preferências ----------
class PreferencesIn(BaseModel):
    genres: list[Annotated[str, Field(max_length=60)]] = []
    decades: list[Annotated[int, Field(ge=1880, le=2100)]] = []
    creators: list[Annotated[str, Field(max_length=120)]] = []
    artists: list[Annotated[str, Field(max_length=120)]] = Field(default=[], description="Artistas de música que a pessoa curte")
    liked_media_ids: list[int] = []


class PreferencesOut(BaseModel):
    genres: list[str]
    decades: list[int]
    creators: list[str]
    artists: list[str] = []
    onboarded: bool


# ---------- Mídia ----------
class MoodOut(BaseModel):
    key: str
    label: str
    count: int = Field(description="Quantos títulos do catálogo têm este clima")


class MediaOut(ORM):
    id: int
    type: str
    source: str
    external_id: str | None
    title: str
    year: int | None
    overview: str
    poster_url: str | None
    backdrop_url: str | None = None
    genres: list[str]
    tags: list[str]
    creators: list[str]
    popularity: float
    duration_min: int | None = Field(default=None, description="Filme: duração; série: episódio; álbum: soma das faixas")
    countries: list[str] = Field(default=[], description="Países de origem, em códigos ISO, como BR")
    language: str | None = Field(default=None, description="Idioma original ou, no álbum, das letras, como pt")
    moods: list[str] = Field(default=[], description='Climas (RNFF09), como "leve"; os nomes vêm de GET /media/moods')
    links: list[dict] = Field(
        default=[],
        description='Álbum: onde ouvir, [{"service", "url", "level"}]. level "artist" leva à página do artista, '
        "quando o disco não tem link próprio",
    )


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
    user_id: int | None = None
    user_name: str
    rating: float | None
    review: str
    consumed_at: date | None
    created_at: datetime
    likes: int = Field(default=0, description="Curtidas na resenha (RFF30)")
    liked: bool = Field(default=False, description="Se quem vê curtiu a resenha")
    comments: int = Field(default=0, description="Comentários visíveis na resenha (RFF30)")
    spoiler: bool = Field(default=False, description="A resenha conta o que acontece; a tela mostra escondida")
    following: bool = Field(default=False, description="Se quem vê segue quem escreveu")


class MyStatus(BaseModel):
    diary_entry_id: int | None = None
    rating: float | None = None
    consumed_at: date | None = None
    status: Literal["seen", "watching"] | None = Field(default=None, description="Série: vista ou assistindo (RFF24)")
    season: int | None = Field(default=None, description="Série: a temporada em que a pessoa está (RFF24)")
    episodes: dict[str, int] = Field(default={}, description="Série: quantos episódios a pessoa marcou em cada temporada")
    spoiler: bool = Field(default=False, description="Se a resenha da pessoa está marcada como spoiler")
    in_watchlist: bool = False
    dismissed: bool = False
    list_ids: list[int] = []


class CreditOut(BaseModel):
    """De onde vêm os dados do título e com que licença (RNFF02)."""

    name: str = Field(description='A fonte, como "TMDB" ou "MusicBrainz"')
    url: str | None = Field(description="A página do título na fonte")
    license: str = Field(description="A licença ou os termos de uso dos dados")


class SeasonOut(BaseModel):
    number: int
    name: str | None = None
    episodes: int | None = None
    year: int | None = None


class FriendRatingOut(BaseModel):
    id: int
    name: str
    rating: float | None
    status: Literal["seen", "watching"] = "seen"


class MediaDetailOut(MediaOut):
    actors: list[str]
    histogram: list[int] = Field(default=[], description="Quantas notas de cada valor, de 0,5 a 5 (10 posições)")
    friends: list[FriendRatingOut] = Field(default=[], description="Quem eu sigo e registrou o título, com a nota")
    seasons: list[SeasonOut] = Field(default=[], description="Temporadas da série, sem os especiais (RFF24)")
    credit: CreditOut | None = None
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
    spoiler: bool = Field(default=False, description="A resenha conta o que acontece")
    status: Literal["seen", "watching"] = Field(
        default="seen", description='Série (RFF24): "watching" para quem ainda está assistindo; "seen" quando terminou'
    )
    season: int | None = Field(default=None, ge=1, description="Série (RFF24): a temporada em que a pessoa está")

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float | None) -> float | None:
        return _check_rating(v)


class DiaryUpdate(BaseModel):
    rating: float | None = None
    review: str | None = Field(default=None, max_length=2000)
    consumed_at: date | None = None
    excluded: bool | None = Field(default=None, description="true: o registro deixa de contar no gosto (RFF07)")
    spoiler: bool | None = Field(default=None, description="A resenha conta o que acontece")
    status: Literal["seen", "watching"] | None = Field(default=None, description="Série (RFF24)")
    season: int | None = Field(default=None, ge=1, description="Série (RFF24)")

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
    excluded: bool = Field(default=False, description="Não conta no gosto (RFF07)")
    spoiler: bool = False
    status: Literal["seen", "watching"] = Field(default="seen", description="Série: vista ou assistindo (RFF24)")
    season: int | None = Field(default=None, description="Série: a temporada (RFF24)")


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
    featured: bool = False
    description: str | None = None
    created_at: datetime
    items: list[ListItemOut]


# ---------- Recomendações ----------
class BecauseOut(BaseModel):
    kind: Literal["genre", "decade", "person", "mood", "title"]
    value: str = Field(description='O que vai no ajuste: o nome, a década ("1990") ou o id do título')
    label: str = Field(description='Para mostrar: "Matrix", "Drama", "anos 90"')


class StreamingOut(BaseModel):
    key: str
    label: str
    logo: str | None


class RecommendationOut(BaseModel):
    media: MediaOut
    score: float
    reason: str
    strategy: str  # hybrid | content | trending | bridge (álbum ligado por uma ponte) | discovery (fora da bolha)
    because: BecauseOut | None = Field(
        default=None, description='O que está por trás do motivo, para o "Não por esse motivo" (RFF08)'
    )
    services: list[str] = Field(
        default=[], description='Os serviços da pessoa onde o título está (RFF21), como ["Netflix"]'
    )
    streaming: list[StreamingOut] = Field(
        default=[], description="Todos os serviços de assinatura onde o título está, com o logo (RFF19)"
    )


class PairOut(BaseModel):
    """Sessão dupla (RFF27): um filme ou série para ver e um disco para ouvir depois."""

    video: RecommendationOut
    album: MediaOut
    kind: str = Field(description="A ponte: soundtrack, composer, same_person, biopic ou documentary")
    reason: str = Field(description='Por que o disco acompanha o filme, como "A trilha sonora de Interestelar"')


class WatchlistNowOut(BaseModel):
    """O Quero ver ordenado pelo que combina agora (RFF22)."""

    items: list[RecommendationOut] = Field(description="O que cabe no momento, do que mais combina ao que menos")
    later: list[RecommendationOut] = Field(description="O resto do Quero ver, que não cabe no momento pedido")


class ServiceOut(BaseModel):
    key: str
    label: str
    count: int = Field(description="Quantos títulos do catálogo estão no serviço")


class OccasionOut(BaseModel):
    key: str
    label: str


class ProviderOut(BaseModel):
    service: str
    kind: Literal["flatrate", "rent", "buy"] = Field(description="Assinatura, aluguel ou compra")
    logo: str | None
    link: str | None = Field(description="Página do título na JustWatch, com os links de cada serviço")


class ConnectionOut(BaseModel):
    media: MediaOut
    kind: str = Field(description="soundtrack | composer | same_person | artist | weak")
    weight: float
    reason: str


class FeedOut(BaseModel):
    variant: str
    strategy: str
    items: list[RecommendationOut]


class UnderstoodPart(BaseModel):
    text: str = Field(description="O trecho do pedido, como a pessoa escreveu")
    labels: list[str] = Field(description='O que ele virou, como "Leve" ou "Até 2h"')


class WishOut(BaseModel):
    """Os filtros que o pedido em português escolheu (RFF25). Os vazios ficam como estão na tela."""

    type: MediaType | None
    mood: str | None
    max_minutes: int | None
    occasion: str | None
    discovery: Literal["beyond", "outside"] | None
    only_mine: bool
    understood: list[UnderstoodPart]
    ignored: list[str] = Field(description="O que o pedido tinha e não virou filtro, com o porquê")


class CommunityEntryOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    media: MediaOut
    rating: float | None
    review: str | None
    consumed_at: date | None
    created_at: datetime
    status: Literal["seen", "watching"] = Field(default="seen", description="Série: vista ou assistindo (RFF24)")
    season: int | None = None
    spoiler: bool = False
    likes: int = Field(default=0, description="Curtidas na resenha (RFF30)")
    liked: bool = Field(default=False, description="Se quem vê curtiu a resenha")
    comments: int = Field(default=0, description="Comentários visíveis na resenha (RFF30)")


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    text: str
    created_at: datetime
    can_delete: bool = Field(description="Quem escreveu e quem escreveu a resenha podem apagar")


class ProfileItemOut(BaseModel):
    media: MediaOut
    rating: float | None


class CompatibilityOut(BaseModel):
    percent: int | None = Field(description="0 a 100; None se uma das duas ainda não registrou o que curte")
    label: str
    shared: list[MediaOut] = Field(description="Títulos que as duas curtiram, nas três mídias")
    genres: list[str]


class BadgeOut(BaseModel):
    """Selo do desafio de um tema do mês (RFF32)."""

    badge: str
    title: str
    month: str


class ChallengeOut(BaseModel):
    """O desafio do tema do mês (RFF32): registrar `goal` títulos do tema no mês para ganhar o selo."""

    month: str
    title: str
    goal: int
    badge: str
    done: list[MediaOut] = Field(description="Os títulos do tema que a pessoa registrou no mês")
    earned: bool
    description: str | None = None
    next: list[MediaOut] = Field(default=[], description="Até 4 títulos do tema que ainda não estão no diário, na ordem do tema")


class ProfileOut(BaseModel):
    id: int
    name: str
    is_me: bool
    pinned: list["MediaOut"] = Field(default=[], description="Os cinco favoritos que a pessoa escolheu, na ordem dela")
    counts: dict[str, int] = Field(description="Registros por mídia: movie, series e album")
    favorites: list[ProfileItemOut]
    recent: list[ProfileItemOut]
    compatibility: CompatibilityOut | None = Field(description="None no próprio perfil")
    following: bool = Field(default=False, description="Se quem vê segue esta pessoa")
    followers: int = Field(default=0, description="Quantas pessoas seguem esta pessoa")
    follows: int = Field(default=0, description="Quantas pessoas esta pessoa segue")
    restricted: bool = Field(
        default=False, description="Os registros são só para quem segue a pessoa, e quem vê ainda não segue (RFF10)"
    )
    badges: list[BadgeOut] = Field(default=[], description="Selos dos desafios do tema do mês (RFF32)")


class PersonOut(BaseModel):
    id: int
    name: str


class ActivityOut(BaseModel):
    """Uma linha do histórico de atividades (RFF31)."""

    kind: Literal["registro", "lista", "curtida", "comentario", "seguiu"]
    at: datetime
    media: MediaOut | None = None
    rating: float | None = None
    text: str | None = Field(default=None, description="A resenha do registro ou o comentário")
    list_name: str | None = None
    person: PersonOut | None = Field(default=None, description="Quem passou a seguir, ou quem escreveu a resenha")


class SuggestedPersonOut(BaseModel):
    """Alguém para seguir, pelo gosto parecido (RFF15)."""

    id: int
    name: str
    percent: int
    label: str


class CommunityPage(BaseModel):
    items: list[CommunityEntryOut]


class ReviewerOut(BaseModel):
    id: int
    name: str
    titles: int
    reviews: int
    likes: int = Field(description="Curtidas recebidas nas resenhas (RFF30)")


class ImpressionIn(BaseModel):
    media_id: int
    strategy: Literal["hybrid", "content", "trending", "bridge", "discovery"]
    score: float


class ImpressionsIn(BaseModel):
    items: list[ImpressionIn] = Field(max_length=100)


class FeedbackIn(BaseModel):
    action: FeedbackAction
    rating: float | None = None
    review: str | None = Field(default=None, max_length=2000)
    consumed_at: date | None = None

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


class AdminUserOut(BaseModel):
    """Uma pessoa na aba Usuários da administração, com o que ela já fez no sistema."""

    id: int
    name: str
    email: str
    role: str
    ab_group: str
    is_synthetic: bool
    onboarded: bool
    created_at: datetime
    diary_entries: int
    reviews: int
    shown: int  # sugestões que apareceram na tela
    accepted: int  # Quero ver + Já vi vindos de sugestões
    last_active: datetime


class AdminUsersOut(BaseModel):
    items: list[AdminUserOut]
    total: int


class AdminCommentOut(BaseModel):
    id: int
    user_name: str
    user_email: str
    entry_id: int
    review_author: str
    media_title: str
    text: str
    hidden: bool
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
    type: VideoType
    tmdb_id: int = Field(gt=0)


class TmdbImportOut(BaseModel):
    media: MediaOut
    result: SyncOut


class AlbumImportIn(BaseModel):
    mbid: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                      description="ID do álbum (release group) no MusicBrainz")


class AlbumImportOut(TmdbImportOut):
    pass


class VariantMetrics(BaseModel):
    variant: str
    users: int
    shown: int
    want: int
    seen: int
    dismiss: int
    acceptance_rate: float
    rated: int = Field(default=0, description="Aceitas que depois ganharam nota no diário")
    satisfied: int = Field(default=0, description="Dessas, quantas ficaram com 3,5 ou mais")
    satisfaction_rate: float | None = Field(default=None, description="satisfied ÷ rated; None sem nenhuma nota (RFF04)")


class ExperimentsIn(BaseModel):
    in_experiments: bool


class VisibilityIn(BaseModel):
    visibility: Literal["all", "followers", "private"] = Field(
        description="all = todos; followers = quem me segue; private = só eu (RFF10)"
    )


class ServicesIn(BaseModel):
    services: list[str] = Field(max_length=20, description="Chaves de GET /media/services, como netflix")


class ExternalAddIn(BaseModel):
    external_id: str = Field(
        pattern=r"^(movie-\d+|tv-\d+|album-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$",
        description="O external_id de GET /external/search: movie-155, tv-1399 ou album-<ID do MusicBrainz>",
    )


class DeleteAccountIn(BaseModel):
    password: str = Field(description="A senha atual, para confirmar")


class TasteFacetOut(BaseModel):
    kind: Literal["genre", "decade", "person", "mood"]
    value: str
    label: str
    share: float = Field(description="Quanto pesa no gosto, de 0 a 1, entre os do mesmo tipo")
    weight: float = Field(description="O ajuste da pessoa: 1 normal, 1,5 mais, 0,5 menos, 0 fora do cálculo")


class TasteTitleOut(BaseModel):
    media: MediaOut
    signal: float = Field(description="Quanto o título pesa no gosto (nota, Já vi, listas)")
    entry_id: int | None
    rating: float | None
    weight: float = Field(description='1 normal; 0,5 depois de um "Não por esse motivo"')


class TasteExcludedOut(BaseModel):
    entry_id: int
    media: MediaOut


class TasteProfileOut(BaseModel):
    genres: list[TasteFacetOut]
    decades: list[TasteFacetOut]
    people: list[TasteFacetOut]
    moods: list[TasteFacetOut]
    titles: list[TasteTitleOut] = Field(description="Os títulos que mais pesam no gosto")
    excluded: list[TasteExcludedOut] = Field(description="Registros que a pessoa tirou do cálculo")
    adjusted: int = Field(description="Quantos ajustes a pessoa fez")


class AdjustmentIn(BaseModel):
    kind: Literal["genre", "decade", "person", "mood", "title"]
    value: str = Field(min_length=1, max_length=120)
    weight: float = Field(ge=0, le=3, description="1 volta ao normal; 1,5 mais; 0,5 menos; 0 tira do cálculo")


class BridgeMetrics(BaseModel):
    """EXP03: a aceitação dos discos sugeridos por ponte, por tipo de ponte."""

    kind: str
    label: str
    shown: int
    accepted: int
    acceptance_rate: float


class MetricsOut(BaseModel):
    overall: VariantMetrics
    by_variant: list[VariantMetrics]
    catalog_size: int
    users: int
    diary_entries: int
    real_users: int
    simulated_shown: int
    trending_shown: int  # exibições "Em alta", fora da comparação A/B
    movies: int
    series: int
    albums: int = 0
    external_neighbors_enabled: bool
    titles_with_neighbors: int
    acceptance_window_days: int = Field(default=7, description="Aceitação só conta até tantos dias depois da exibição")
    opted_out: int = Field(default=0, description="Pessoas que saíram dos experimentos (RFF17)")
    by_bridge: list[BridgeMetrics] = Field(default=[], description="EXP03: aceitação dos discos por tipo de ponte")


class ImportFile(BaseModel):
    name: str = Field(max_length=200, description='O nome do arquivo, como "ratings.csv"')
    content: str = Field(max_length=5_000_000, description="O texto do CSV")


class LetterboxdIn(BaseModel):
    files: list[ImportFile] = Field(min_length=1, max_length=10)


class LetterboxdOut(BaseModel):
    """O resultado da importação do Letterboxd (RFF18)."""

    registered: int = Field(description="Filmes que entraram no diário")
    want_to_watch: int = Field(description="Filmes que entraram no Quero ver")
    already_in_diary: int = Field(description="Filmes que já estavam no diário e ficaram como estavam")
    brought: int = Field(description="Filmes trazidos do TMDB para o catálogo")
    next_time: int = Field(description="Filmes achados no TMDB que ficam para o próximo envio (limite por envio)")
    not_found: list[str] = Field(description="Até 50 filmes que não foram achados")
    not_found_total: int
    ignored_files: list[str] = Field(description="Arquivos que não são do export do Letterboxd ou que não usamos")


class ArrivalOut(BaseModel):
    """Um título do Quero ver que chegou a um serviço da pessoa (RFF29)."""

    media: MediaOut
    service: StreamingOut
    since: datetime = Field(description="Quando o Tastory viu o título no serviço pela primeira vez")


class ShowcasePairOut(BaseModel):
    video: MediaOut
    album: MediaOut
    kind: str
    reason: str = Field(description='Por que o disco acompanha o filme, como "A trilha sonora de Interestelar"')


class ShowcaseOut(BaseModel):
    """Exemplos para a apresentação, antes de entrar: pares de filme e disco e os álbuns mais ouvidos."""

    pairs: list[ShowcasePairOut]
    albums: list[MediaOut]


class AvatarIn(BaseModel):
    image: str = Field(
        max_length=420_000,
        description='A foto como data URL, "data:image/jpeg;base64,...", já reduzida pela tela. JPEG, PNG ou WebP, até 300 KB',
    )


class AccountEditIn(BaseModel):
    """Mudar o nome e o e-mail da conta (Minha conta). Só os campos enviados mudam."""

    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("o nome deve ter pelo menos 2 caracteres")
        return v.strip() if v else v


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError(f"a senha deve ter no máximo {MAX_PASSWORD_BYTES} bytes")
        return v


class EpisodeOut(BaseModel):
    """Um episódio da temporada, com o que quem vê marcou: visto, nota e anotação (RFF24)."""

    number: int
    name: str | None = None
    air_date: date | None = None
    overview: str | None = None
    still_url: str | None = Field(default=None, description="Uma cena do episódio, do TMDB")
    runtime: int | None = Field(default=None, description="Duração em minutos")
    directors: list[str] = []
    seen: bool = False
    rating: float | None = None
    note: str | None = None


class PartRef(BaseModel):
    """O episódio de antes ou de depois. Na virada de temporada, o nome pode não vir."""

    season: int
    number: int
    name: str | None = None


class EpisodeDetailOut(EpisodeOut):
    """A página do episódio: o episódio, a série, os vizinhos e o que todo mundo achou."""

    season: int
    series: "MediaOut"
    previous: PartRef | None = None
    next: PartRef | None = None
    seen_by: int = Field(description="Quantas pessoas marcaram o episódio como visto")
    ratings: int = Field(description="Quantas notas o episódio recebeu")
    average: float | None = Field(default=None, description="Média das notas de todo mundo")


class TrackOut(BaseModel):
    """Uma faixa do álbum, com o que quem ouve marcou: ouvi, nota e anotação."""

    disc: int
    number: int
    title: str
    length_sec: int | None = Field(default=None, description="Duração em segundos")
    artists: list[str] = []
    seen: bool = Field(default=False, description="Ouvi esta faixa")
    rating: float | None = None
    note: str | None = None


class TrackRef(BaseModel):
    disc: int
    number: int
    title: str


class TrackDetailOut(TrackOut):
    """A página da faixa: a faixa, o álbum, as vizinhas e o que todo mundo achou."""

    album: "MediaOut"
    position: int = Field(description="Em que posição a faixa está no álbum, contando todos os discos")
    total: int = Field(description="Quantas faixas o álbum tem")
    discs: int = Field(description="Quantos discos o álbum tem")
    previous: TrackRef | None = None
    next: TrackRef | None = None
    seen_by: int = Field(description="Quantas pessoas marcaram a faixa como ouvida")
    ratings: int
    average: float | None = None


class PartSaved(BaseModel):
    """O que ficou guardado de um episódio ou de uma faixa."""

    number: int
    seen: bool
    rating: float | None = None
    note: str | None = None


class EpisodeIn(BaseModel):
    """Vale para episódios e faixas."""

    rating: float | None = Field(default=None, description="De 0,5 a 5")
    note: str | None = Field(default=None, max_length=1000, description="Anotação, só para a própria pessoa")
    seen: bool | None = Field(
        default=None,
        description="true marca como visto (ou ouvido) mesmo sem nota; false desmarca e apaga nota e anotação. "
        "Sem este campo, sem nota e sem anotação, volta a não visto",
    )

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float | None) -> float | None:
        return _check_rating(v)


class PinnedIn(BaseModel):
    media_ids: list[int] = Field(max_length=5, description="Até 5 títulos do próprio diário, na ordem em que aparecem")
