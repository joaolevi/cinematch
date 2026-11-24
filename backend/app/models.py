"""Modelo relacional (pacote 3.1 da EAP).

Tabelas do MVP: users, user_preferences, user_interests, media, item_neighbors, diary_entries, lists, list_items,
rec_events, dismissed.
Entrega final (migração 0002): media_bridges, follows, review_likes, review_comments, taste_adjustments, e colunas
novas em users, media, diary_entries e lists. Toda mudança aqui precisa de migração ("Mudanças no banco" no
CONTRIBUTING.md); colunas novas obrigatórias levam server_default, para valer também nas linhas que já existem.
"""

from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="user")  # user | admin
    ab_group: Mapped[str] = mapped_column(String(1), default="A")  # A = híbrido, B = só conteúdo
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)  # usuários gerados pelo seed
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Quem vê os registros da pessoa: all | followers | private (RFF10)
    visibility: Mapped[str] = mapped_column(String(10), default="all", server_default="all")
    # Serviços de streaming que a pessoa assina, como "netflix" (RFF21)
    services: Mapped[list[str]] = mapped_column(JSON, default=list, server_default=text("'[]'"))

    preferences: Mapped[list["UserPreference"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserPreference(Base):
    __tablename__ = "user_preferences"
    __table_args__ = (UniqueConstraint("user_id", "genre"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    genre: Mapped[str] = mapped_column(String(60))

    user: Mapped[User] = relationship(back_populates="preferences")


class UserInterest(Base):
    """Interesses do onboarding além dos gêneros: décadas e criadores."""

    __tablename__ = "user_interests"
    __table_args__ = (UniqueConstraint("user_id", "kind", "value"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # decade | creator
    value: Mapped[str] = mapped_column(String(120))


class Media(Base):
    __tablename__ = "media"
    __table_args__ = (UniqueConstraint("source", "external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(10), index=True)  # movie | series | album
    source: Mapped[str] = mapped_column(String(20), default="manual")  # mock | tmdb | musicbrainz | manual
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overview: Mapped[str] = mapped_column(Text, default="")
    poster_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    genres: Mapped[list[str]] = mapped_column(JSON, default=list)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    creators: Mapped[list[str]] = mapped_column(JSON, default=list)  # direção, criação ou, no álbum, artistas
    actors: Mapped[list[str]] = mapped_column(JSON, default=list)
    popularity: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Filme: duração; série: duração do episódio; álbum: soma das faixas (RFF20)
    duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    countries: Mapped[list[str]] = mapped_column(JSON, default=list, server_default=text("'[]'"))  # códigos ISO, como "BR"
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)  # idioma original, como "pt"
    moods: Mapped[list[str]] = mapped_column(JSON, default=list, server_default=text("'[]'"))  # climas (RNFF09)
    # Álbum: links para ouvir, [{"service": "spotify", "url": "..."}] (RFF19)
    links: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default=text("'[]'"))
    # Filme e série: onde assistir no Brasil, [{"service", "kind": flatrate | rent | buy}] (RFF19)
    providers: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default=text("'[]'"))
    providers_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Série: [{"number", "name", "episodes", "year"}] (RFF24)
    seasons: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default=text("'[]'"))


class ItemNeighbor(Base):
    """Títulos parecidos, calculados com avaliações de uma base externa, como o MovieLens."""

    __tablename__ = "item_neighbors"
    __table_args__ = (UniqueConstraint("media_id", "neighbor_id", "source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), index=True)
    neighbor_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(20))
    score: Mapped[float] = mapped_column(Float)


class DiaryEntry(Base):
    """Registro de consumo ("Já vi"), com nota e resenha opcionais."""

    __tablename__ = "diary_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), index=True)
    consumed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0.5 a 5.0
    review: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_hidden: Mapped[bool] = mapped_column(Boolean, default=False)  # moderação
    from_onboarding: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(10), default="seen", server_default="seen")  # seen | watching (RFF24)
    season: Mapped[int | None] = mapped_column(Integer, nullable=True)  # temporada da série (RFF24)
    # A pessoa tirou o registro do cálculo do gosto (RFF07)
    excluded: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    media: Mapped[Media] = relationship()
    user: Mapped[User] = relationship()


class UserList(Base):
    __tablename__ = "lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    is_watchlist: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Tema do mês: lista curada pelo admin, em destaque no Início (RFF32)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    items: Mapped[list["ListItem"]] = relationship(
        back_populates="list", cascade="all, delete-orphan", order_by="ListItem.added_at.desc()"
    )


class ListItem(Base):
    __tablename__ = "list_items"
    __table_args__ = (UniqueConstraint("list_id", "media_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(ForeignKey("lists.id", ondelete="CASCADE"), index=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    list: Mapped[UserList] = relationship(back_populates="items")
    media: Mapped[Media] = relationship()


class RecEvent(Base):
    """Evento do feed: exibição (shown) e ações (want | seen | dismiss). Base da taxa de aceitação."""

    __tablename__ = "rec_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(10), index=True)
    variant: Mapped[str] = mapped_column(String(1))
    strategy: Mapped[str] = mapped_column(String(20), default="hybrid")
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Dismissed(Base):
    __tablename__ = "dismissed"
    __table_args__ = (UniqueConstraint("user_id", "media_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------- entrega final


class MediaBridge(Base):
    """Ligação entre dois títulos, em geral de mídias diferentes: compositor, trilha, década, país... (RFF26).

    Calculada por script e lida pelo grafo de gosto. Guardada nos dois sentidos.
    """

    __tablename__ = "media_bridges"
    __table_args__ = (UniqueConstraint("media_id", "other_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), index=True)
    other_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))  # composer | soundtrack | same_person | biopic | decade | country...
    label: Mapped[str] = mapped_column(String(255))  # o que aparece no motivo, como "Hans Zimmer"
    weight: Mapped[float] = mapped_column(Float)  # alto, médio ou baixo, como na tabela do ARQUITETURA.md
    source: Mapped[str] = mapped_column(String(20))  # wikidata | tmdb | musicbrainz | regra


class Follow(Base):
    """Quem segue quem (RFF09)."""

    __tablename__ = "follows"
    __table_args__ = (UniqueConstraint("follower_id", "followed_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    followed_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReviewLike(Base):
    """Curtida numa resenha, que é um registro do diário com texto (RFF30)."""

    __tablename__ = "review_likes"
    __table_args__ = (UniqueConstraint("entry_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("diary_entries.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReviewComment(Base):
    """Comentário numa resenha, com moderação pelo admin (RFF30)."""

    __tablename__ = "review_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("diary_entries.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TasteAdjustment(Base):
    """Ajuste que a pessoa fez no próprio gosto: mais ou menos de um gênero, década, pessoa, clima ou ponte.

    Vem do "mais" e "menos" do perfil de gosto (RFF07) e do "não por esse motivo" das sugestões (RFF08).
    O grafo multiplica o peso do nó correspondente.
    """

    __tablename__ = "taste_adjustments"
    __table_args__ = (UniqueConstraint("user_id", "kind", "value"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # genre | decade | person | mood | bridge
    value: Mapped[str] = mapped_column(String(120))
    weight: Mapped[float] = mapped_column(Float)  # > 1 pede mais; < 1 pede menos; 0 tira do cálculo
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
