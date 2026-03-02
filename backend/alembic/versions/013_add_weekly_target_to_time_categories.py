"""Ajouter weekly_minutes_target aux time_categories

Revision ID: 013_weekly_target
Revises: 012_parent_id_time_cat
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013_weekly_target'
down_revision = '012_parent_id_time_cat'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter la colonne weekly_minutes_target pour le budget temps par semaine
    op.add_column(
        'time_categories',
        sa.Column('weekly_minutes_target', sa.Integer(), server_default='0', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('time_categories', 'weekly_minutes_target')
