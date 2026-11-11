"""Ambiente do Alembic: liga as migrações aos modelos e ao mesmo banco da aplicação.

Chamado de dois jeitos:
- pela aplicação (`app.migrations.atualizar_banco`), que passa a conexão já preparada;
- pela linha de comando (`make migrate`, `make migration`), que abre a conexão a partir de TASTORY_DATABASE_URL.
"""

from alembic import context
from alembic.script import ScriptDirectory

import app.models  # noqa: F401  (registra as tabelas no Base.metadata)
from app.config import settings
from app.db import Base, make_engine
from app.migrations import sem_chaves_estrangeiras

config = context.config
target_metadata = Base.metadata


def _numerar(ctx, _revision, directives) -> None:
    """No `make migration`: numera em sequência (0002, 0003...) e não cria arquivo se os modelos não mudaram."""
    script = directives[0]
    if config.cmd_opts and getattr(config.cmd_opts, "autogenerate", False) and script.upgrade_ops.is_empty():
        directives[:] = []
        print("Nenhuma mudança nos modelos: nenhuma migração criada.")
        return
    head = ScriptDirectory.from_config(config).get_current_head()
    script.rev_id = f"{int(head) + 1:04d}" if head else "0001"


def _configurar(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        process_revision_directives=_numerar,
        # O SQLite não altera colunas: o modo batch recria a tabela com os dados
        render_as_batch=connection.dialect.name == "sqlite",
        compare_type=True,
    )


def rodar_offline() -> None:
    context.configure(url=settings.database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def rodar_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        # Quem chamou já abriu a transação e cuidou das chaves estrangeiras do SQLite
        _configurar(connection)
        context.run_migrations()
        return
    engine = make_engine(settings.database_url)
    with engine.connect() as conn, sem_chaves_estrangeiras(conn):
        with conn.begin():
            _configurar(conn)
            context.run_migrations()


if context.is_offline_mode():
    rodar_offline()
else:
    rodar_online()
