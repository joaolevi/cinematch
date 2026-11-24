"""Ajustes que a pessoa faz no próprio gosto (RFF07) e no retorno sobre uma sugestão (RFF08).

Cada ajuste é um peso para um gênero, uma década, uma pessoa, um clima ou um título curtido:
- 1,5 pede mais; 0,5 pede menos; 0 tira do cálculo (o gênero, a pessoa ou o clima deixam de ser sugeridos);
- num título curtido ("title"), o peso multiplica o quanto ele conta no gosto: 0,5 é "não por esse motivo".
Sem ajuste, o peso é 1. O recomendador multiplica a nota de cada candidato pelos pesos que batem com ele.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Media, TasteAdjustment

KINDS = ("genre", "decade", "person", "mood", "title")
MORE, LESS, OFF = 1.5, 0.5, 0.0

Adjustments = dict[tuple[str, str], float]


def load(db: Session, user_id: int) -> Adjustments:
    return {
        (kind, value): weight
        for kind, value, weight in db.execute(
            select(TasteAdjustment.kind, TasteAdjustment.value, TasteAdjustment.weight).where(
                TasteAdjustment.user_id == user_id
            )
        )
    }


def save(db: Session, user_id: int, kind: str, value: str, weight: float) -> None:
    """Grava o ajuste; peso 1 volta ao normal e apaga o ajuste."""
    row = db.scalar(
        select(TasteAdjustment).where(
            TasteAdjustment.user_id == user_id, TasteAdjustment.kind == kind, TasteAdjustment.value == value
        )
    )
    if weight == 1:
        if row is not None:
            db.delete(row)
    elif row is None:
        db.add(TasteAdjustment(user_id=user_id, kind=kind, value=value, weight=weight))
    else:
        row.weight = weight
    db.commit()


def factor(media: Media, adjustments: Adjustments) -> float:
    """O peso de um candidato: o produto dos ajustes de gênero, década, pessoa e clima que batem com ele."""
    if not adjustments:
        return 1.0
    keys = [("genre", g) for g in media.genres or []]
    keys += [("mood", m) for m in media.moods or []]
    keys += [("person", p) for p in (media.creators or []) + (media.actors or [])]
    if media.year:
        keys.append(("decade", str((media.year // 10) * 10)))
    weight = 1.0
    for key in keys:
        weight *= adjustments.get(key, 1.0)
    return weight
