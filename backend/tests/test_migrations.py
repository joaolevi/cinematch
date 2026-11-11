"""Migrações do banco (RNFF01).

Rodam sempre num SQLite próprio. Com TASTORY_TEST_POSTGRES_URL definida (o CI define), rodam também num PostgreSQL,
que é o banco do servidor. Cada teste recebe um banco vazio, separado do banco dos outros testes.
"""

import json
import os
from datetime import datetime, timezone

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import String, inspect, text

from app.db import Base, make_engine
from app.migrations import (
    VERSAO_INICIAL,
    BancoNaoConfere,
    alembic_config,
    apagar_banco,
    atualizar_banco,
    diferencas_do_mvp,
    sem_chaves_estrangeiras,
    versao_atual,
)

POSTGRES_URL = os.getenv("TASTORY_TEST_POSTGRES_URL")
BANCOS = ["sqlite"] + (["postgresql"] if POSTGRES_URL else [])
HEAD = ScriptDirectory.from_config(alembic_config()).get_current_head()


@pytest.fixture(params=BANCOS)
def engine(request, tmp_path):
    if request.param == "sqlite":
        eng = make_engine(f"sqlite:///{tmp_path / 'migracoes.db'}")
    else:
        eng = make_engine(POSTGRES_URL)
        with eng.begin() as conn:
            conn.exec_driver_sql("DROP SCHEMA public CASCADE")
            conn.exec_driver_sql("CREATE SCHEMA public")
    yield eng
    eng.dispose()


def migrar_ate(engine, revisao: str) -> None:
    with engine.begin() as conn:
        command.upgrade(alembic_config(conn), revisao)


def banco_do_mvp_com_dados(engine) -> None:
    """Um banco como o do servidor: criado antes das migrações, sem a tabela de versão, com dados."""
    migrar_ate(engine, VERSAO_INICIAL)
    agora = datetime.now(timezone.utc)
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE alembic_version")
        conn.execute(
            text(
                "INSERT INTO users (id, name, email, password_hash, role, ab_group, is_synthetic, onboarded, created_at)"
                " VALUES (1, 'Ana', 'ana@teste.com', 'x', 'user', 'A', false, true, :agora)"
            ),
            {"agora": agora},
        )
        conn.execute(
            text(
                "INSERT INTO media (id, type, source, title, overview, genres, tags, creators, actors, popularity,"
                " created_at) VALUES (1, 'movie', 'manual', 'Bacurau', '', '[]', '[]', '[]', '[]', 0, :agora)"
            ),
            {"agora": agora},
        )
        conn.execute(
            text(
                "INSERT INTO diary_entries (id, user_id, media_id, rating, review_hidden, from_onboarding, created_at)"
                " VALUES (1, 1, 1, 4.5, false, false, :agora)"
            ),
            {"agora": agora},
        )


def contagens(engine) -> tuple:
    with engine.connect() as conn:
        return tuple(conn.execute(text(f"SELECT count(*) FROM {t}")).scalar() for t in ("users", "media", "diary_entries"))


def test_banco_vazio_chega_na_ultima_versao_igual_aos_modelos(engine):
    resultado = atualizar_banco(engine)
    assert resultado == {"situacao": "vazio", "antes": None, "depois": HEAD}
    with engine.connect() as conn:
        diferencas = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diferencas == [], "Os modelos mudaram sem migração: rode `make migration MSG=...`"


def test_versao_inicial_confere_com_a_foto_do_banco_do_mvp(engine):
    migrar_ate(engine, VERSAO_INICIAL)
    with engine.connect() as conn:
        assert diferencas_do_mvp(conn) == []


def test_adota_o_banco_do_mvp_sem_perder_dados(engine):
    banco_do_mvp_com_dados(engine)
    antes = contagens(engine)
    resultado = atualizar_banco(engine)
    assert resultado["situacao"] == "adotado"
    assert resultado["depois"] == HEAD
    assert contagens(engine) == antes == (1, 1, 1)
    # As colunas novas valem também para as linhas que já existiam (valor padrão no banco)
    with engine.connect() as conn:
        visibilidade, servicos = conn.execute(text("SELECT visibility, services FROM users")).one()
        status, excluido = conn.execute(text("SELECT status, excluded FROM diary_entries")).one()
        paises = conn.execute(text("SELECT countries FROM media")).scalar()
    lista = lambda v: json.loads(v) if isinstance(v, str) else v  # noqa: E731  (o SQLite devolve o JSON como texto)
    assert (visibilidade, lista(servicos), status, bool(excluido), lista(paises)) == ("all", [], "seen", False, [])


def test_recusa_banco_que_nao_confere_e_nao_mexe_nele(engine):
    banco_do_mvp_com_dados(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("ALTER TABLE users ADD COLUMN apelido VARCHAR(20)")
    with pytest.raises(BancoNaoConfere, match="coluna a mais em users: apelido"):
        atualizar_banco(engine)
    with engine.connect() as conn:
        assert versao_atual(conn) is None
    assert contagens(engine) == (1, 1, 1)


def test_banco_ja_versionado_so_recebe_o_que_falta(engine):
    atualizar_banco(engine)
    assert atualizar_banco(engine) == {"situacao": "versionado", "antes": HEAD, "depois": HEAD}


def test_ida_e_volta_das_migracoes(engine):
    migrar_ate(engine, "head")
    with engine.begin() as conn:
        command.downgrade(alembic_config(conn), "base")
    assert set(inspect(engine).get_table_names()) <= {"alembic_version"}
    migrar_ate(engine, "head")
    assert set(Base.metadata.tables) <= set(inspect(engine).get_table_names())


def test_apagar_banco_permite_recriar_do_zero(engine):
    banco_do_mvp_com_dados(engine)
    atualizar_banco(engine)
    apagar_banco(engine)
    assert inspect(engine).get_table_names() == []
    assert atualizar_banco(engine)["situacao"] == "vazio"
    assert contagens(engine) == (0, 0, 0)


def test_sqlite_volta_com_as_chaves_estrangeiras_ligadas(tmp_path):
    """As migrações desligam as chaves no SQLite; a conexão precisa voltar ao pool com elas ligadas."""
    eng = make_engine(f"sqlite:///{tmp_path / 'chaves.db'}")
    atualizar_banco(eng)
    with eng.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    eng.dispose()


def test_sqlite_recriar_uma_tabela_nao_apaga_as_tabelas_filhas(tmp_path):
    """Para mudar uma coluna, o SQLite recria a tabela. Com as chaves ligadas, o ON DELETE CASCADE apagaria o diário
    de todo mundo ao apagar a tabela users antiga. É o que as migrações dos próximos PRs vão fazer."""
    eng = make_engine(f"sqlite:///{tmp_path / 'recriar.db'}")
    banco_do_mvp_com_dados(eng)
    atualizar_banco(eng)
    with eng.connect() as conn, sem_chaves_estrangeiras(conn):
        with conn.begin():
            op = Operations(MigrationContext.configure(conn, opts={"render_as_batch": True}))
            with op.batch_alter_table("users", recreate="always") as batch:
                batch.alter_column("name", type_=String(150), existing_type=String(120))
    assert contagens(eng) == (1, 1, 1)
    eng.dispose()
