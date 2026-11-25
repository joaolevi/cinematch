"""Tema do mês (RFF32): uma prateleira curada no Início, com as três mídias, um desafio e um selo.

Os temas ficam em `data/tema_do_mes.json`, um por mês (`"mes": "2026-12"`), com título, descrição, o desafio (quantos
títulos do tema registrar no mês e o nome do selo) e os títulos, na ordem. `load_theme` transforma o tema do mês atual
numa lista em destaque (`featured`) da conta de administração. A troca é sozinha: quando o mês vira, a primeira visita
à prateleira (`ensure_current_theme`) carrega o tema novo. O desafio conta os registros no diário de títulos do tema
feitos dentro do mês dele; quem chega à meta ganha o selo, que fica no perfil.
"""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import DATA_DIR
from ..models import DiaryEntry, ListItem, Media, User, UserList
from .catalog import search_text

THEME_PATH = DATA_DIR / "tema_do_mes.json"
DEFAULT_GOAL = 3


def all_themes(path: Path | None = None) -> list[dict]:
    """Os temas do arquivo, do mês mais antigo ao mais novo. Aceita o formato antigo, com um tema só e sem mês."""
    path = path or THEME_PATH
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    themes = data.get("temas") or [data]
    return sorted(themes, key=lambda t: t.get("mes", ""))


def current_theme(path: Path | None = None, today: date | None = None) -> dict | None:
    """O tema do mês de hoje; sem tema para este mês, o mais recente que já começou; sem nenhum, o primeiro."""
    themes = all_themes(path)
    if not themes:
        return None
    month = (today or datetime.now(timezone.utc).date()).strftime("%Y-%m")
    started = [t for t in themes if t.get("mes", "") <= month]
    return started[-1] if started else themes[0]


def _theme_media(db: Session, theme: dict) -> tuple[list[Media], list[str]]:
    """Os títulos do tema que estão no catálogo, na ordem do tema, e os que faltam."""
    by_key = {}
    for m in sorted(db.scalars(select(Media)), key=lambda m: m.popularity):  # no empate de título, fica o mais popular
        by_key[(m.type, search_text(m.title))] = m
    found, missing = [], []
    for item in theme["itens"]:
        media = by_key.get((item["tipo"], search_text(item["titulo"])))
        if media is None:
            missing.append(item["titulo"])
        elif media not in found:
            found.append(media)
    return found, missing


def load_theme(db: Session, path: Path | None = None, today: date | None = None) -> dict:
    """Cria ou atualiza a lista em destaque com o tema do mês. Títulos que não estão no catálogo ficam de fora e são
    avisados."""
    admin = db.scalar(select(User).where(User.role == "admin").order_by(User.id))
    theme = current_theme(path, today)
    if admin is None or theme is None:
        return {"items": 0, "missing": []}

    shelf = db.scalar(select(UserList).where(UserList.user_id == admin.id, UserList.featured.is_(True)))
    if shelf is None:
        shelf = UserList(user_id=admin.id, name=theme["titulo"], featured=True)
        db.add(shelf)
        db.flush()
    shelf.name, shelf.description = theme["titulo"], theme.get("descricao")
    for item in shelf.items:
        db.delete(item)
    db.flush()

    found, missing = _theme_media(db, theme)
    now = datetime.now(timezone.utc)
    for position, media in enumerate(found):
        # A lista mostra do mais novo para o mais antigo: a data decrescente mantém a ordem do tema
        db.add(ListItem(list_id=shelf.id, media_id=media.id, added_at=now - timedelta(seconds=position)))
    db.commit()
    db.expire(shelf)  # os itens novos foram gravados direto: a lista carregada antes precisa ser lida de novo
    return {"items": len(found), "missing": missing}


def ensure_current_theme(db: Session, path: Path | None = None, today: date | None = None) -> None:
    """Troca a prateleira quando o mês vira: se o tema em destaque não é o do mês, carrega o novo."""
    theme = current_theme(path, today)
    if theme is None:
        return
    shelf = db.scalar(select(UserList).where(UserList.featured.is_(True)))
    if shelf is None or shelf.name != theme["titulo"]:
        load_theme(db, path, today)


def _month_bounds(month: str) -> tuple[datetime, datetime]:
    year, mon = (int(x) for x in month.split("-"))
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + (mon == 12), mon % 12 + 1, 1, tzinfo=timezone.utc)
    return start, end


def _progress(db: Session, user_id: int, theme: dict) -> tuple[list[Media], int]:
    """Os títulos do tema que a pessoa registrou no mês do tema, e a meta."""
    goal = int((theme.get("desafio") or {}).get("meta", DEFAULT_GOAL))
    found, _ = _theme_media(db, theme)
    if not theme.get("mes") or not found:
        return [], goal
    start, end = _month_bounds(theme["mes"])
    ids = {m.id for m in found}
    done_ids = set()
    for media_id, at in db.execute(
        select(DiaryEntry.media_id, DiaryEntry.created_at).where(
            DiaryEntry.user_id == user_id, DiaryEntry.from_onboarding.is_(False), DiaryEntry.media_id.in_(ids)
        )
    ):
        at = at if at.tzinfo else at.replace(tzinfo=timezone.utc)
        if start <= at < end:
            done_ids.add(media_id)
    return [m for m in found if m.id in done_ids], goal


def challenge(db: Session, user_id: int, path: Path | None = None, today: date | None = None) -> dict | None:
    """O desafio do tema do mês para a pessoa: a meta, o que já registrou e se ganhou o selo."""
    theme = current_theme(path, today)
    if theme is None or not theme.get("mes"):
        return None
    done, goal = _progress(db, user_id, theme)
    return {
        "month": theme["mes"],
        "title": theme["titulo"],
        "goal": goal,
        "badge": (theme.get("desafio") or {}).get("selo", theme["titulo"]),
        "done": done,
        "earned": len(done) >= goal,
    }


def badges(db: Session, user_id: int, path: Path | None = None) -> list[dict]:
    """Os selos que a pessoa ganhou, um por tema em que chegou à meta, do mais novo ao mais antigo."""
    out = []
    for theme in reversed(all_themes(path)):
        if not theme.get("mes"):
            continue
        done, goal = _progress(db, user_id, theme)
        if len(done) >= goal:
            out.append({"badge": (theme.get("desafio") or {}).get("selo", theme["titulo"]), "title": theme["titulo"],
                        "month": theme["mes"]})
    return out
