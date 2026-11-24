"""Os serviços de streaming que a pessoa assina (RFF21).

O TMDB, com dados da JustWatch, dá o nome de cada serviço onde o título está ("Netflix", "Amazon Prime Video with
Ads", "HBO Max Amazon Channel"...). Aqui esses nomes viram uma lista curta de serviços, a que a pessoa marca em
Minha conta. Só conta a assinatura: aluguel e compra não entram em "só o que eu tenho". Um canal dentro de outro
serviço ("Telecine Amazon Channel") conta como o serviço do canal, que é o que a pessoa precisa assinar.
"""

import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Media


@dataclass(frozen=True)
class Service:
    key: str
    label: str
    names: tuple[str, ...]  # nomes do TMDB já simplificados por `_plain`


SERVICES: tuple[Service, ...] = (
    Service("netflix", "Netflix", ("netflix",)),
    Service("prime", "Prime Video", ("amazon prime video",)),
    Service("max", "Max", ("hbo max", "max")),
    Service("disney", "Disney+", ("disney plus",)),
    Service("globoplay", "Globoplay", ("globoplay",)),
    Service("apple", "Apple TV", ("apple tv", "apple tv plus")),
    Service("paramount", "Paramount+", ("paramount plus",)),
    Service("telecine", "Telecine", ("telecine", "telecine play")),
    Service("mubi", "MUBI", ("mubi",)),
    Service("crunchyroll", "Crunchyroll", ("crunchyroll",)),
    Service("claro", "Claro tv+", ("claro video", "claro tv plus")),
    Service("looke", "Looke", ("looke",)),
)

BY_KEY = {s.key: s for s in SERVICES}
_BY_NAME = {name: s.key for s in SERVICES for name in s.names}

# Sufixos que não mudam o serviço: o plano com anúncios e os canais vendidos dentro de outro serviço
_SUFFIXES = re.compile(r"\s+(standard with ads|with ads|premium|basic|amazon channel|apple tv channel)$")


def _plain(name: str) -> str:
    plain = name.lower().replace("+", " plus").strip()
    plain = re.sub(r"\s+", " ", plain)
    while True:
        shorter = _SUFFIXES.sub("", plain)
        if shorter == plain:
            return plain
        plain = shorter


def service_key(provider_name: str) -> str | None:
    """A chave do serviço ("netflix") a partir do nome que o TMDB usa. Serviços fora da lista dão None."""
    return _BY_NAME.get(_plain(provider_name))


def services_of(media: Media) -> set[str]:
    """Os serviços de assinatura onde o título está, pelo que foi guardado do TMDB."""
    return {
        key
        for p in media.providers or []
        if p.get("kind") == "flatrate" and (key := service_key(p.get("service", ""))) is not None
    }


def labels_on(media: Media, mine: list[str]) -> list[str]:
    """Os nomes dos serviços da pessoa onde o título está, na ordem da lista ("Netflix", "Max")."""
    if not mine:
        return []
    found = services_of(media) & set(mine)
    return [s.label for s in SERVICES if s.key in found]


def available_ids(db: Session, mine: list[str]) -> set[int]:
    """Os títulos que estão em pelo menos um dos serviços da pessoa."""
    wanted = set(mine)
    if not wanted:
        return set()
    return {
        m.id
        for m in db.scalars(select(Media).where(Media.type.in_(("movie", "series"))))
        if services_of(m) & wanted
    }


def catalog_counts(db: Session) -> dict[str, int]:
    """Quantos títulos do catálogo estão em cada serviço."""
    counts = {s.key: 0 for s in SERVICES}
    for m in db.scalars(select(Media).where(Media.type.in_(("movie", "series")))):
        for key in services_of(m):
            counts[key] += 1
    return counts
