"""Ajouter parent_id aux time_categories pour les sous-catégories

Revision ID: 012_parent_id_time_cat
Revises: 011_time_entries
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012_parent_id_time_cat'
down_revision = '011_time_entries'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter la colonne parent_id pour les sous-catégories
    op.add_column(
        'time_categories',
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('time_categories.id'), nullable=True)
    )
    # Index pour les requêtes par parent
    op.create_index('ix_time_categories_parent', 'time_categories', ['parent_id'])


def downgrade() -> None:
    op.drop_index('ix_time_categories_parent', table_name='time_categories')
    op.drop_column('time_categories', 'parent_id')
