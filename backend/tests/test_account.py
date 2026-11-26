"""A própria conta (RFF06), sair dos experimentos (RFF17), limite de login (RNFF05) e a medição (RFF04, RNFF04)."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.models import Follow, RecEvent, User
from app.services import login_guard

from .conftest import ADMIN_EMAIL, ADMIN_PASSWORD, auth_headers, media_id_by_title, register, see_feed


def me(client, headers):
    return client.get("/me", headers=headers).json()


# ---------------------------------------------------------------- exportar e excluir
def test_exporta_os_proprios_dados_sem_a_senha(client, user_headers):
    mid = media_id_by_title(client, user_headers, "Matrix")
    client.post("/diary", json={"media_id": mid, "rating": 4.5, "review": "clássico"}, headers=user_headers)
    data = client.get("/me/export", headers=user_headers).json()
    assert data["account"]["email"] == "fulano@teste.com"
    assert "password" not in str(data["account"]) and "password_hash" not in str(data)
    assert data["diary"][0]["media"]["title"] == "Matrix" and data["diary"][0]["review"] == "clássico"
    assert any(lst["is_watchlist"] for lst in data["lists"])


def test_exclui_a_propria_conta_com_a_senha(client, user_headers, db):
    outra = register(client, "Outra", "outra@teste.com")
    my_id, other_id = me(client, user_headers)["id"], me(client, outra)["id"]
    client.put(f"/users/{other_id}/follow", headers=user_headers)
    client.put(f"/users/{my_id}/follow", headers=outra)

    assert client.request("DELETE", "/me", json={"password": "errada1"}, headers=user_headers).status_code == 403
    assert client.request("DELETE", "/me", json={"password": "segredo1"}, headers=user_headers).status_code == 204
    db.expire_all()
    assert db.get(User, my_id) is None
    assert db.scalars(select(Follow).where((Follow.follower_id == my_id) | (Follow.followed_id == my_id))).all() == []
    assert client.post("/auth/login", json={"email": "fulano@teste.com", "password": "segredo1"}).status_code == 401
    assert client.get(f"/users/{other_id}", headers=outra).json()["followers"] == 0


def test_admin_nao_se_exclui_por_aqui(client):
    admin = auth_headers(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert client.request("DELETE", "/me", json={"password": ADMIN_PASSWORD}, headers=admin).status_code == 400


# ---------------------------------------------------------------- sair dos experimentos
def test_fim_do_ab_quem_era_do_grupo_b_recebe_o_completo(client, user_headers, admin_headers, db):
    """O A/B acabou na entrega final (D29): quem tinha ficado no grupo B, ou saído dos experimentos, recebe o híbrido,
    e os eventos novos contam no grupo A e na taxa geral."""
    db.execute(update(User).where(User.email == "fulano@teste.com").values(ab_group="B", in_experiments=False))
    db.commit()
    feed = client.get("/recommendations", params={"limit": 5}, headers=user_headers).json()
    assert feed["variant"] == "A"
    see_feed(client, user_headers, limit=5)
    m = client.get("/admin/metrics", headers=admin_headers).json()
    assert m["overall"]["shown"] == 5


# ---------------------------------------------------------------- limite de login
def test_bloqueia_depois_de_cinco_senhas_erradas(client, user_headers):
    for _ in range(login_guard.MAX_PER_EMAIL):
        assert client.post("/auth/login", json={"email": "fulano@teste.com", "password": "errada1"}).status_code == 401
    r = client.post("/auth/login", json={"email": "fulano@teste.com", "password": "segredo1"})
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 0
    assert "Muitas tentativas" in r.json()["detail"]
    # outro e-mail do mesmo lugar ainda entra
    register(client, "Outra", "outra@teste.com")
    assert client.post("/auth/login", json={"email": "outra@teste.com", "password": "segredo1"}).status_code == 200


def test_janela_do_limite_libera_e_acerto_zera():
    login_guard.reset()
    for i in range(login_guard.MAX_PER_EMAIL):
        login_guard.failed("a@b.c", "1.1.1.1", now=1000.0 + i)
    assert login_guard.wait_seconds("a@b.c", "1.1.1.1", now=1010.0) > 0
    assert login_guard.wait_seconds("a@b.c", "1.1.1.1", now=1000.0 + login_guard.WINDOW_SECONDS + 1) == 0
    login_guard.failed("a@b.c", "1.1.1.1", now=5000.0)
    login_guard.succeeded("a@b.c")
    assert login_guard.wait_seconds("a@b.c", "1.1.1.1", now=5001.0) == 0


# ---------------------------------------------------------------- medição
def test_satisfacao_conta_as_aceitas_com_nota(client, user_headers, admin_headers):
    items = see_feed(client, user_headers, limit=6)
    ids = [i["media"]["id"] for i in items]
    for mid, rating in zip(ids[:3], (5, 4, 2)):
        client.post(f"/recommendations/{mid}/feedback", json={"action": "seen", "rating": rating}, headers=user_headers)
    client.post(f"/recommendations/{ids[3]}/feedback", json={"action": "want"}, headers=user_headers)  # sem nota
    overall = client.get("/admin/metrics", headers=admin_headers).json()["overall"]
    assert overall["rated"] == 3 and overall["satisfied"] == 2
    assert overall["satisfaction_rate"] == round(2 / 3, 4)


def test_sem_nota_a_satisfacao_fica_vazia(client, user_headers, admin_headers):
    see_feed(client, user_headers, limit=3)
    assert client.get("/admin/metrics", headers=admin_headers).json()["overall"]["satisfaction_rate"] is None


def test_aceitacao_so_conta_ate_sete_dias_depois_da_exibicao(client, user_headers, admin_headers, db):
    items = see_feed(client, user_headers, limit=2)
    old, recent = items[0]["media"]["id"], items[1]["media"]["id"]
    # a primeira sugestão apareceu há 10 dias; a reação de hoje não conta mais
    ten_days_ago = datetime.now(timezone.utc) - timedelta(days=10)
    db.execute(update(RecEvent).where(RecEvent.media_id == old, RecEvent.action == "shown").values(created_at=ten_days_ago))
    db.commit()
    for mid in (old, recent):
        client.post(f"/recommendations/{mid}/feedback", json={"action": "want"}, headers=user_headers)
    overall = client.get("/admin/metrics", headers=admin_headers).json()
    assert overall["acceptance_window_days"] == 7
    assert overall["overall"]["want"] == 1 and overall["overall"]["acceptance_rate"] == 0.5
