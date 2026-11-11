"""Banco do MVP: as tabelas que o create_all criava até a entrega de 10/11/2026.

Um banco criado antes das migrações é adotado nesta versão (app/migrations.py).

Revisão: 0001
Anterior: nenhuma
Criada em: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('media',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('type', sa.String(length=10), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('external_id', sa.String(length=64), nullable=True),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.Column('overview', sa.Text(), nullable=False),
    sa.Column('poster_url', sa.String(length=500), nullable=True),
    sa.Column('genres', sa.JSON(), nullable=False),
    sa.Column('tags', sa.JSON(), nullable=False),
    sa.Column('creators', sa.JSON(), nullable=False),
    sa.Column('actors', sa.JSON(), nullable=False),
    sa.Column('popularity', sa.Float(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name='media_pkey'),
    sa.UniqueConstraint('source', 'external_id', name='media_source_external_id_key')
    )
    op.create_index('ix_media_title', 'media', ['title'], unique=False)
    op.create_index('ix_media_type', 'media', ['type'], unique=False)

    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.String(length=10), nullable=False),
    sa.Column('ab_group', sa.String(length=1), nullable=False),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.Column('onboarded', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name='users_pkey')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table('diary_entries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('media_id', sa.Integer(), nullable=False),
    sa.Column('consumed_at', sa.Date(), nullable=True),
    sa.Column('rating', sa.Float(), nullable=True),
    sa.Column('review', sa.Text(), nullable=True),
    sa.Column('review_hidden', sa.Boolean(), nullable=False),
    sa.Column('from_onboarding', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], name='diary_entries_media_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='diary_entries_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='diary_entries_pkey')
    )
    op.create_index('ix_diary_entries_media_id', 'diary_entries', ['media_id'], unique=False)
    op.create_index('ix_diary_entries_user_id', 'diary_entries', ['user_id'], unique=False)

    op.create_table('dismissed',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('media_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], name='dismissed_media_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='dismissed_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='dismissed_pkey'),
    sa.UniqueConstraint('user_id', 'media_id', name='dismissed_user_id_media_id_key')
    )
    op.create_index('ix_dismissed_media_id', 'dismissed', ['media_id'], unique=False)
    op.create_index('ix_dismissed_user_id', 'dismissed', ['user_id'], unique=False)

    op.create_table('item_neighbors',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('media_id', sa.Integer(), nullable=False),
    sa.Column('neighbor_id', sa.Integer(), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('score', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], name='item_neighbors_media_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['neighbor_id'], ['media.id'], name='item_neighbors_neighbor_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='item_neighbors_pkey'),
    sa.UniqueConstraint('media_id', 'neighbor_id', 'source', name='item_neighbors_media_id_neighbor_id_source_key')
    )
    op.create_index('ix_item_neighbors_media_id', 'item_neighbors', ['media_id'], unique=False)

    op.create_table('lists',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('is_watchlist', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='lists_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='lists_pkey')
    )
    op.create_index('ix_lists_user_id', 'lists', ['user_id'], unique=False)

    op.create_table('rec_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('media_id', sa.Integer(), nullable=False),
    sa.Column('action', sa.String(length=10), nullable=False),
    sa.Column('variant', sa.String(length=1), nullable=False),
    sa.Column('strategy', sa.String(length=20), nullable=False),
    sa.Column('score', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], name='rec_events_media_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='rec_events_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='rec_events_pkey')
    )
    op.create_index('ix_rec_events_action', 'rec_events', ['action'], unique=False)
    op.create_index('ix_rec_events_media_id', 'rec_events', ['media_id'], unique=False)
    op.create_index('ix_rec_events_user_id', 'rec_events', ['user_id'], unique=False)

    op.create_table('user_interests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('value', sa.String(length=120), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='user_interests_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='user_interests_pkey'),
    sa.UniqueConstraint('user_id', 'kind', 'value', name='user_interests_user_id_kind_value_key')
    )
    op.create_index('ix_user_interests_user_id', 'user_interests', ['user_id'], unique=False)

    op.create_table('user_preferences',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('genre', sa.String(length=60), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='user_preferences_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='user_preferences_pkey'),
    sa.UniqueConstraint('user_id', 'genre', name='user_preferences_user_id_genre_key')
    )
    op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'], unique=False)

    op.create_table('list_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('list_id', sa.Integer(), nullable=False),
    sa.Column('media_id', sa.Integer(), nullable=False),
    sa.Column('added_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['list_id'], ['lists.id'], name='list_items_list_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['media_id'], ['media.id'], name='list_items_media_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='list_items_pkey'),
    sa.UniqueConstraint('list_id', 'media_id', name='list_items_list_id_media_id_key')
    )
    op.create_index('ix_list_items_list_id', 'list_items', ['list_id'], unique=False)
    op.create_index('ix_list_items_media_id', 'list_items', ['media_id'], unique=False)



def downgrade() -> None:
    op.drop_index('ix_list_items_media_id', table_name='list_items')
    op.drop_index('ix_list_items_list_id', table_name='list_items')

    op.drop_table('list_items')
    op.drop_index('ix_user_preferences_user_id', table_name='user_preferences')

    op.drop_table('user_preferences')
    op.drop_index('ix_user_interests_user_id', table_name='user_interests')

    op.drop_table('user_interests')
    op.drop_index('ix_rec_events_user_id', table_name='rec_events')
    op.drop_index('ix_rec_events_media_id', table_name='rec_events')
    op.drop_index('ix_rec_events_action', table_name='rec_events')

    op.drop_table('rec_events')
    op.drop_index('ix_lists_user_id', table_name='lists')

    op.drop_table('lists')
    op.drop_index('ix_item_neighbors_media_id', table_name='item_neighbors')

    op.drop_table('item_neighbors')
    op.drop_index('ix_dismissed_user_id', table_name='dismissed')
    op.drop_index('ix_dismissed_media_id', table_name='dismissed')

    op.drop_table('dismissed')
    op.drop_index('ix_diary_entries_user_id', table_name='diary_entries')
    op.drop_index('ix_diary_entries_media_id', table_name='diary_entries')

    op.drop_table('diary_entries')
    op.drop_index('ix_users_email', table_name='users')

    op.drop_table('users')
    op.drop_index('ix_media_type', table_name='media')
    op.drop_index('ix_media_title', table_name='media')

    op.drop_table('media')
