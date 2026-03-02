"""Ajouter le champ name_changed aux entreprises

Revision ID: 015_name_changed
Revises: 014_time_budget_pct
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015_name_changed'
down_revision = '014_time_budget_pct'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter le champ pour tracker si le nom a été modifié
    op.add_column(
        'companies',
        sa.Column('name_changed', sa.Boolean(), server_default='false', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('companies', 'name_changed')
