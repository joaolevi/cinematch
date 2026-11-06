"""Modelo relacional (pacote 3.1 da EAP).

Tabelas: users, user_preferences, user_interests, media, diary_entries, lists, list_items, rec_events, dismissed.
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
    type: Mapped[str] = mapped_column(String(10), index=True)  # movie | series ('album' no incremento 2)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # mock | tmdb | manual
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overview: Mapped[str] = mapped_column(Text, default="")
    poster_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    genres: Mapped[list[str]] = mapped_column(JSON, default=list)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    creators: Mapped[list[str]] = mapped_column(JSON, default=list)
    popularity: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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

    media: Mapped[Media] = relationship()
    user: Mapped[User] = relationship()


class UserList(Base):
    __tablename__ = "lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    is_watchlist: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

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
