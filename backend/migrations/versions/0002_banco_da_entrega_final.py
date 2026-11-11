"""Banco da entrega final (26/11/2026): todas as tabelas e colunas novas numa só migração.

Tabelas novas: media_bridges (RFF26), follows (RFF09), review_likes e review_comments (RFF30) e
taste_adjustments (RFF07, RFF08). Colunas novas em users (RFF10, RFF21), media (RFF01, RFF19, RFF20, RNFF09, RFF24),
diary_entries (RFF07, RFF24) e lists (RFF32). As obrigatórias têm valor padrão, que vale para as linhas que já existem.

Revisão: 0002
Anterior: 0001
Criada em: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('follows',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('follower_id', sa.Integer(), nullable=False),
    sa.Column('followed_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['followed_id'], ['users.id'], name='follows_followed_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['follower_id'], ['users.id'], name='follows_follower_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='follows_pkey'),
    sa.UniqueConstraint('follower_id', 'followed_id', name='follows_follower_id_followed_id_key')
    )
    op.create_index('ix_follows_followed_id', 'follows', ['followed_id'], unique=False)
    op.create_index('ix_follows_follower_id', 'follows', ['follower_id'], unique=False)

    op.create_table('media_bridges',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('media_id', sa.Integer(), nullable=False),
    sa.Column('other_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=False),
    sa.Column('weight', sa.Float(), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], name='media_bridges_media_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['other_id'], ['media.id'], name='media_bridges_other_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='media_bridges_pkey'),
    sa.UniqueConstraint('media_id', 'other_id', 'kind', name='media_bridges_media_id_other_id_kind_key')
    )
    op.create_index('ix_media_bridges_media_id', 'media_bridges', ['media_id'], unique=False)

    op.create_table('taste_adjustments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('value', sa.String(length=120), nullable=False),
    sa.Column('weight', sa.Float(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='taste_adjustments_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='taste_adjustments_pkey'),
    sa.UniqueConstraint('user_id', 'kind', 'value', name='taste_adjustments_user_id_kind_value_key')
    )
    op.create_index('ix_taste_adjustments_user_id', 'taste_adjustments', ['user_id'], unique=False)

    op.create_table('review_comments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('entry_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('hidden', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['entry_id'], ['diary_entries.id'], name='review_comments_entry_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='review_comments_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='review_comments_pkey')
    )
    op.create_index('ix_review_comments_entry_id', 'review_comments', ['entry_id'], unique=False)
    op.create_index('ix_review_comments_user_id', 'review_comments', ['user_id'], unique=False)

    op.create_table('review_likes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('entry_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['entry_id'], ['diary_entries.id'], name='review_likes_entry_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='review_likes_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='review_likes_pkey'),
    sa.UniqueConstraint('entry_id', 'user_id', name='review_likes_entry_id_user_id_key')
    )
    op.create_index('ix_review_likes_entry_id', 'review_likes', ['entry_id'], unique=False)
    op.create_index('ix_review_likes_user_id', 'review_likes', ['user_id'], unique=False)

    with op.batch_alter_table('diary_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=10), server_default='seen', nullable=False))
        batch_op.add_column(sa.Column('season', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('excluded', sa.Boolean(), server_default=sa.false(), nullable=False))

    with op.batch_alter_table('lists', schema=None) as batch_op:
        batch_op.add_column(sa.Column('featured', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))

    with op.batch_alter_table('media', schema=None) as batch_op:
        batch_op.add_column(sa.Column('duration_min', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('countries', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
        batch_op.add_column(sa.Column('language', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('moods', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
        batch_op.add_column(sa.Column('links', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
        batch_op.add_column(sa.Column('providers', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
        batch_op.add_column(sa.Column('providers_updated_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('seasons', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('visibility', sa.String(length=10), server_default='all', nullable=False))
        batch_op.add_column(sa.Column('services', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))



def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('services')
        batch_op.drop_column('visibility')

    with op.batch_alter_table('media', schema=None) as batch_op:
        batch_op.drop_column('seasons')
        batch_op.drop_column('providers_updated_at')
        batch_op.drop_column('providers')
        batch_op.drop_column('links')
        batch_op.drop_column('moods')
        batch_op.drop_column('language')
        batch_op.drop_column('countries')
        batch_op.drop_column('duration_min')

    with op.batch_alter_table('lists', schema=None) as batch_op:
        batch_op.drop_column('description')
        batch_op.drop_column('featured')

    with op.batch_alter_table('diary_entries', schema=None) as batch_op:
        batch_op.drop_column('excluded')
        batch_op.drop_column('season')
        batch_op.drop_column('status')

    op.drop_index('ix_review_likes_user_id', table_name='review_likes')
    op.drop_index('ix_review_likes_entry_id', table_name='review_likes')

    op.drop_table('review_likes')
    op.drop_index('ix_review_comments_user_id', table_name='review_comments')
    op.drop_index('ix_review_comments_entry_id', table_name='review_comments')

    op.drop_table('review_comments')
    op.drop_index('ix_taste_adjustments_user_id', table_name='taste_adjustments')

    op.drop_table('taste_adjustments')
    op.drop_index('ix_media_bridges_media_id', table_name='media_bridges')

    op.drop_table('media_bridges')
    op.drop_index('ix_follows_follower_id', table_name='follows')
    op.drop_index('ix_follows_followed_id', table_name='follows')

    op.drop_table('follows')
