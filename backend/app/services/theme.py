"""Tema do mês (RFF32): uma prateleira curada no Início, com as três mídias.

O tema fica em `data/tema_do_mes.json` (título, descrição e os títulos, na ordem). `load_theme` transforma o tema numa
lista em destaque (`featured`) da conta de administração. Para trocar o tema, edite o arquivo e rode o seed ou
`make prod-albuns`.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import DATA_DIR
from ..models import ListItem, Media, User, UserList
from .catalog import search_text

THEME_PATH = DATA_DIR / "tema_do_mes.json"


def load_theme(db: Session, path: Path = THEME_PATH) -> dict:
    """Cria ou atualiza a lista em destaque do tema. Títulos que não estão no catálogo ficam de fora e são avisados."""
    admin = db.scalar(select(User).where(User.role == "admin").order_by(User.id))
    if admin is None or not path.exists():
        return {"items": 0, "missing": []}
    theme = json.loads(path.read_text(encoding="utf-8"))
    catalog = list(db.scalars(select(Media)))
    by_key = {}
    for m in sorted(catalog, key=lambda m: m.popularity):  # no empate de título, fica o mais popular
        by_key[(m.type, search_text(m.title))] = m

    shelf = db.scalar(select(UserList).where(UserList.user_id == admin.id, UserList.featured.is_(True)))
    if shelf is None:
        shelf = UserList(user_id=admin.id, name=theme["titulo"], featured=True)
        db.add(shelf)
        db.flush()
    shelf.name, shelf.description = theme["titulo"], theme.get("descricao")
    for item in list(shelf.items):
        db.delete(item)
    db.flush()

    missing, now = [], datetime.now(timezone.utc)
    added = 0
    for position, item in enumerate(theme["itens"]):
        media = by_key.get((item["tipo"], search_text(item["titulo"])))
        if media is None:
            missing.append(item["titulo"])
            continue
        # A lista mostra do mais novo para o mais antigo: a data decrescente mantém a ordem do tema
        db.add(ListItem(list_id=shelf.id, media_id=media.id, added_at=now - timedelta(seconds=position)))
        added += 1
    db.commit()
    return {"items": added, "missing": missing}
