"""Dados iniciais do protótipo.

- Catálogo mockado (data/seed_catalog.json)
- Contas de demonstração: admin e demo
- ~30 usuários sintéticos com "personas" de gosto, para o filtro colaborativo ter dados
- Simulação opcional do teste A/B (usuários sintéticos interagindo com o feed)
"""

import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import crud
from .auth import hash_password
from .config import settings
from .models import Media, RecEvent, User
from .services.catalog import MockCatalogProvider, sync_catalog
from .services.recommender import recommend

ADMIN_EMAIL, ADMIN_PASSWORD = "admin@tastory.dev", settings.admin_password
DEMO_EMAIL, DEMO_PASSWORD = "demo@tastory.dev", settings.demo_password
SYNTHETIC_PASSWORD = settings.synthetic_password

PERSONAS: list[tuple[str, list[str]]] = [
    ("terror", ["Terror", "Suspense"]),
    ("scifi", ["Ficção Científica", "Ação"]),
    ("animacao", ["Animação", "Família", "Fantasia"]),
    ("romance", ["Romance", "Drama"]),
    ("crime", ["Crime", "Mistério"]),
    ("comedia", ["Comédia"]),
]

FIRST_NAMES = [
    "Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Heitor", "Isabela", "Jonas",
    "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sofia", "Tiago", "Úrsula", "Vítor",
    "Yasmin", "André", "Beatriz", "Caio", "Débora", "Enzo", "Fernanda", "Gustavo", "Helena", "Igor",
]

GOOD_REVIEWS = [
    "Simplesmente incrível, já quero rever.",
    "Um dos melhores que vi nos últimos tempos.",
    "Prende do começo ao fim.",
    "Roteiro muito bem amarrado.",
    "Visual e trilha sonora impecáveis.",
]
BAD_REVIEWS = [
    "Não é pra mim.",
    "Achei arrastado demais.",
    "Esperava bem mais.",
]


def persona_of(user: User) -> list[str] | None:
    """Recupera a persona de um usuário sintético pelo prefixo do e-mail."""
    if not user.is_synthetic:
        return None
    prefix = user.email.split(".")[0]
    for slug, genres in PERSONAS:
        if prefix == slug:
            return genres
    return None


def load_catalog(db: Session) -> dict:
    return sync_catalog(db, MockCatalogProvider(settings.seed_catalog_path, "Seed"), source="mock")


def load_albums(db: Session) -> dict | None:
    """Álbuns de demonstração (RFF01), do retrato gerado por scripts/import_albums.py. Funciona sem internet."""
    if not settings.albums_catalog_path.exists():
        return None
    return sync_catalog(db, MockCatalogProvider(settings.albums_catalog_path, "Álbuns"), source="musicbrainz")


def _get_or_create_user(db: Session, name: str, email: str, password: str, **kw) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(name=name, email=email, password_hash=hash_password(password), **kw)
        db.add(user)
        db.flush()
        crud.get_or_create_watchlist(db, user)
    return user


def create_demo_accounts(db: Session) -> None:
    _get_or_create_user(db, "Administrador", ADMIN_EMAIL, ADMIN_PASSWORD, role="admin", ab_group="A")
    _get_or_create_user(db, "Visitante", DEMO_EMAIL, DEMO_PASSWORD, ab_group="A")
    db.commit()


def create_synthetic_users(db: Session, per_persona: int = 5, seed: int = 42) -> int:
    rng = random.Random(seed)
    # As personas são de filmes e séries; os álbuns entram no gosto delas só quando houver dados reais
    catalog = list(db.scalars(select(Media).where(Media.type.in_(("movie", "series")))))
    pw_hash = hash_password(SYNTHETIC_PASSWORD)  # um hash só, para o seed ser rápido
    names = iter(FIRST_NAMES * 2)
    created = 0
    for slug, genres in PERSONAS:
        liked_pool = [m for m in catalog if set(m.genres) & set(genres)]
        other_pool = [m for m in catalog if not set(m.genres) & set(genres)]
        for i in range(per_persona):
            email = f"{slug}.{i + 1}@seed.tastory.dev"
            if db.scalar(select(User).where(User.email == email)):
                continue
            user = User(
                name=next(names),
                email=email,
                password_hash=pw_hash,
                is_synthetic=True,
                onboarded=True,
                ab_group="A" if created % 2 == 0 else "B",
            )
            db.add(user)
            db.flush()
            wl = crud.get_or_create_watchlist(db, user)

            likes = rng.sample(liked_pool, k=min(len(liked_pool), rng.randint(8, 14)))
            dislikes = rng.sample(other_pool, k=min(len(other_pool), rng.randint(2, 4)))
            for m in likes:
                review = rng.choice(GOOD_REVIEWS) if rng.random() < 0.3 else None
                crud.upsert_diary(db, user, m.id, rating=rng.choice([3.5, 4.0, 4.5, 5.0]), review=review)
            for m in dislikes:
                review = rng.choice(BAD_REVIEWS) if rng.random() < 0.3 else None
                crud.upsert_diary(db, user, m.id, rating=rng.choice([1.0, 1.5, 2.0, 2.5]), review=review)
            seen = {m.id for m in likes + dislikes}
            for m in rng.sample([m for m in liked_pool if m.id not in seen], k=3):
                crud.add_to_list(db, wl, m.id)
            created += 1
    db.commit()
    return created


def simulate_ab_test(db: Session, rounds: int = 2, feed_size: int = 10, seed: int = 7) -> int:
    """Usuários sintéticos (beta testers) reagem ao feed conforme a persona.

    Aceitam com mais frequência títulos alinhados ao seu gosto; o resultado alimenta
    o painel de métricas do admin (taxa de aceitação por variante A/B).
    """
    rng = random.Random(seed)
    users = list(db.scalars(select(User).where(User.is_synthetic.is_(True))))
    events = 0
    for _ in range(rounds):
        for user in users:
            genres = set(persona_of(user) or [])
            _, recs = recommend(db, user, None, feed_size)
            for r in recs:
                db.add(RecEvent(user_id=user.id, media_id=r.media.id, action="shown",
                                variant=user.ab_group, strategy=r.strategy, score=r.score))
                match = bool(genres & set(r.media.genres))
                accept_p = 0.7 if match else 0.15
                if rng.random() < accept_p:
                    if rng.random() < 0.5:
                        action = "want"
                        crud.add_to_list(db, crud.get_or_create_watchlist(db, user), r.media.id)
                    else:
                        action = "seen"
                        rating = rng.choice([3.5, 4.0, 4.5, 5.0] if match else [2.5, 3.0, 3.5])
                        crud.upsert_diary(db, user, r.media.id, rating=rating)
                else:
                    action = "dismiss"
                    crud.dismiss(db, user, r.media.id)
                db.add(RecEvent(user_id=user.id, media_id=r.media.id, action=action, variant=user.ab_group))
                events += 1
            db.commit()
    return events


def seed_all(db: Session, synthetic: bool = True, simulate: bool = True) -> dict:
    summary = {"catalog": load_catalog(db), "albums": load_albums(db)}
    create_demo_accounts(db)
    if synthetic:
        summary["synthetic_users"] = create_synthetic_users(db)
        if simulate:
            summary["simulated_events"] = simulate_ab_test(db)
    return summary
