"""Migrações do banco com o Alembic (RNFF01).

`atualizar_banco` roda na inicialização da API e nos scripts. Ela:
1. adota um banco criado antes das migrações (o do MVP), marcando-o na versão inicial, se ele conferir;
2. aplica as migrações que faltam.

Para criar uma migração nova, veja "Mudanças no banco" no CONTRIBUTING.md.
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, inspect, text

log = logging.getLogger("tastory")

BACKEND_DIR = Path(__file__).resolve().parent.parent
VERSAO_INICIAL = "0001"

# Foto do banco do MVP (versão 0001): tabelas e colunas que o create_all criava antes das migrações.
# Fica congelada: serve para conferir um banco antigo antes de adotá-lo, mesmo quando os modelos já mudaram.
BANCO_DO_MVP: dict[str, set[str]] = {
    "diary_entries": {"id", "user_id", "media_id", "consumed_at", "rating", "review", "review_hidden",
                      "from_onboarding", "created_at"},
    "dismissed": {"id", "user_id", "media_id", "created_at"},
    "item_neighbors": {"id", "media_id", "neighbor_id", "source", "score"},
    "list_items": {"id", "list_id", "media_id", "added_at"},
    "lists": {"id", "user_id", "name", "is_watchlist", "created_at"},
    "media": {"id", "type", "source", "external_id", "title", "year", "overview", "poster_url", "genres", "tags",
              "creators", "actors", "popularity", "created_at"},
    "rec_events": {"id", "user_id", "media_id", "action", "variant", "strategy", "score", "created_at"},
    "user_interests": {"id", "user_id", "kind", "value"},
    "user_preferences": {"id", "user_id", "genre"},
    "users": {"id", "name", "email", "password_hash", "role", "ab_group", "is_synthetic", "onboarded", "created_at"},
}


class BancoNaoConfere(RuntimeError):
    """O banco existe, não tem versão do Alembic e não é igual ao banco do MVP: não dá para adotá-lo com segurança."""


def alembic_config(connection: Connection | None = None) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    if connection is not None:
        cfg.attributes["connection"] = connection
    return cfg


@contextmanager
def sem_chaves_estrangeiras(conn: Connection) -> Iterator[None]:
    """No SQLite, desliga as chaves estrangeiras durante as migrações.

    Para mudar uma coluna, o SQLite recria a tabela. Com as chaves ligadas, apagar a tabela antiga dispararia o
    ON DELETE CASCADE e apagaria os registros das tabelas filhas. No fim, confere a integridade e religa as chaves
    fora de qualquer transação, para a conexão voltar ao pool como estava.
    """
    if conn.dialect.name != "sqlite":
        yield
        return
    conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
    conn.commit()
    try:
        yield
        if problemas := conn.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError(f"Migração deixou referências quebradas no SQLite: {problemas[:5]}")
    finally:
        if conn.in_transaction():
            conn.rollback()
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        conn.commit()


def diferencas_do_mvp(conn: Connection) -> list[str]:
    """O que impede adotar o banco: tabelas ou colunas diferentes das do banco do MVP."""
    insp = inspect(conn)
    existentes = set(insp.get_table_names())
    problemas = [f"falta a tabela {t}" for t in sorted(set(BANCO_DO_MVP) - existentes)]
    for tabela in sorted(set(BANCO_DO_MVP) & existentes):
        colunas = {c["name"] for c in insp.get_columns(tabela)}
        problemas += [f"falta a coluna {tabela}.{c}" for c in sorted(BANCO_DO_MVP[tabela] - colunas)]
        problemas += [f"coluna a mais em {tabela}: {c}" for c in sorted(colunas - BANCO_DO_MVP[tabela])]
    return problemas


def _adotar_se_preciso(conn: Connection) -> str:
    tabelas = set(inspect(conn).get_table_names())
    if "alembic_version" in tabelas:
        return "versionado"
    if not tabelas & set(BANCO_DO_MVP):
        return "vazio"
    if problemas := diferencas_do_mvp(conn):
        raise BancoNaoConfere(
            "O banco já existe, mas não confere com o banco do MVP, então não foi adotado: "
            + "; ".join(problemas)
            + ". Faça um backup e veja docs/tecnico/DEPLOY.md."
        )
    command.stamp(alembic_config(conn), VERSAO_INICIAL)
    return "adotado"


def versao_atual(conn: Connection) -> str | None:
    if "alembic_version" not in inspect(conn).get_table_names():
        return None
    return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def atualizar_banco(engine: Engine) -> dict:
    """Adota o banco do MVP, se for o caso, e aplica as migrações pendentes. Retorna o que aconteceu."""
    with engine.connect() as conn, sem_chaves_estrangeiras(conn):
        antes = versao_atual(conn)
        conn.commit()
        with conn.begin():
            situacao = _adotar_se_preciso(conn)
            command.upgrade(alembic_config(conn), "head")
        depois = versao_atual(conn)
    if situacao == "adotado":
        log.warning("Banco criado antes das migrações: adotado na versão %s.", VERSAO_INICIAL)
    if antes != depois:
        log.warning("Banco atualizado: versão %s -> %s.", antes or "nenhuma", depois)
    return {"situacao": situacao, "antes": antes, "depois": depois}


def apagar_banco(engine: Engine) -> None:
    """Apaga todas as tabelas, inclusive a de versão do Alembic. Usado pelo seed, que recria tudo do zero."""
    from .db import Base

    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
