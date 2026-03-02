"""Ajouter budget temps par pourcentage

Revision ID: 014_time_budget_pct
Revises: 013_weekly_target
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014_time_budget_pct'
down_revision = '013_weekly_target'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter le budget hebdomadaire global dans company_settings
    op.add_column(
        'company_settings',
        sa.Column('time_weekly_budget_minutes', sa.Integer(), server_default='2400', nullable=False)
    )

    # Ajouter le pourcentage dans time_categories
    op.add_column(
        'time_categories',
        sa.Column('percentage', sa.Float(), server_default='0', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('time_categories', 'percentage')
    op.drop_column('company_settings', 'time_weekly_budget_minutes')
