"""Tema do mês (RFF32): a prateleira curada do Início."""

import json

from app.models import UserList
from app.services.theme import load_theme


def tema(tmp_path, itens):
    path = tmp_path / "tema.json"
    path.write_text(json.dumps({"titulo": "Feito no Nordeste", "descricao": "Com Alagoas na frente.", "itens": itens}),
                    encoding="utf-8")
    return path


def test_tema_vira_lista_em_destaque_na_ordem(client, user_headers, db, tmp_path):
    path = tema(tmp_path, [{"tipo": "movie", "titulo": "Bacurau"}, {"tipo": "movie", "titulo": "o auto da compadecida"},
                           {"tipo": "album", "titulo": "Disco Que Não Existe"}])
    assert load_theme(db, path) == {"items": 2, "missing": ["Disco Que Não Existe"]}
    shelves = client.get("/lists/featured", headers=user_headers).json()
    assert len(shelves) == 1 and shelves[0]["featured"] and shelves[0]["description"] == "Com Alagoas na frente."
    assert [i["media"]["title"] for i in shelves[0]["items"]] == ["Bacurau", "O Auto da Compadecida"]


def test_rodar_de_novo_troca_o_tema_sem_duplicar(client, user_headers, db, tmp_path):
    load_theme(db, tema(tmp_path, [{"tipo": "movie", "titulo": "Bacurau"}]))
    load_theme(db, tema(tmp_path, [{"tipo": "movie", "titulo": "Central do Brasil"}]))
    assert db.query(UserList).filter_by(featured=True).count() == 1
    shelf = client.get("/lists/featured", headers=user_headers).json()[0]
    assert [i["media"]["title"] for i in shelf["items"]] == ["Central do Brasil"]


def test_tema_nao_aparece_nas_listas_de_quem_ve(client, user_headers, db, tmp_path):
    load_theme(db, tema(tmp_path, [{"tipo": "movie", "titulo": "Bacurau"}]))
    assert all(not lst["featured"] for lst in client.get("/lists", headers=user_headers).json())


def test_tema_do_repositorio_bate_com_o_catalogo_de_demonstracao(db):
    from app.seed import load_albums

    load_albums(db)
    assert load_theme(db)["missing"] == []
