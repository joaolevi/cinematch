"""Vitrine (app/vitrine.py): a conta demo cheia e as pessoas de exemplo, para ver o sistema com dados."""

from sqlalchemy import func, select

from app.config import settings
from app.models import DiaryEntry, EpisodeEntry, Follow, ReviewComment, ReviewLike, User
from app.seed import DEMO_EMAIL, VITRINE_DOMAIN
from app.vitrine import build_vitrine
from tests.conftest import auth_headers


def contagens(db):
    return [db.scalar(select(func.count()).select_from(t)) for t in (User, DiaryEntry, Follow, ReviewLike,
                                                                      ReviewComment, EpisodeEntry)]


def test_vitrine_preenche_a_demo_e_a_comunidade(client, db, admin_headers):
    antes = client.get("/admin/metrics", headers=admin_headers).json()
    resumo = build_vitrine(db)
    assert resumo["pessoas"] == 5 and resumo["curtidas"] > 0 and resumo["comentarios"] > 0

    demo = auth_headers(client, DEMO_EMAIL, settings.demo_password)
    eu = client.get("/me", headers=demo).json()
    assert eu["onboarded"]
    diario = client.get("/diary", headers=demo).json()
    assert len(diario) >= 15
    assert any(e["status"] == "watching" for e in diario)  # Dark, com nota nos episódios
    assert any(e["rating"] is None for e in diario)  # o lembrete de nota do Início
    perfil = client.get(f"/users/{eu['id']}", headers=demo).json()
    assert len(perfil["pinned"]) == 5

    # A Comunidade mostra os registros mais novos primeiro, com resenhas curtidas e comentadas
    seguindo = client.get("/community", params={"following": True}, headers=demo).json()["items"]
    assert seguindo and all(item["user_name"] != "Júlia Prado" for item in seguindo)
    dias = [item["created_at"] for item in seguindo]
    assert dias == sorted(dias, reverse=True)
    assert db.scalar(select(func.count()).select_from(ReviewComment)) >= 5

    # As resenhas mais curtidas são as do Davi
    assert client.get("/community/reviewers", headers=demo).json()[0]["name"] == "Davi Rocha"

    # As pessoas de exemplo não contam como pessoas reais nas métricas
    depois = client.get("/admin/metrics", headers=admin_headers).json()
    assert depois["real_users"] == antes["real_users"]
    assert depois["diary_entries"] - antes["diary_entries"] == len(diario)  # só os da Visitante
    assert db.scalar(select(func.count()).select_from(User).where(User.email.like(f"%@{VITRINE_DOMAIN}"))) == 5


def test_vitrine_pode_rodar_de_novo_sem_duplicar(db):
    build_vitrine(db)
    primeira = contagens(db)
    build_vitrine(db)
    assert contagens(db) == primeira
