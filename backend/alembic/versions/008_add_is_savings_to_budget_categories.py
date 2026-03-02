"""Add is_savings column to budget_categories for savings tracking

Revision ID: 008_is_savings
Revises: 007_account_type
Create Date: 2026-01-31

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_is_savings'
down_revision = '007_account_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter la colonne is_savings avec valeur par défaut False
    op.add_column('budget_categories', sa.Column(
        'is_savings',
        sa.Boolean(),
        nullable=False,
        server_default='false'
    ))


def downgrade() -> None:
    # Supprimer la colonne
    op.drop_column('budget_categories', 'is_savings')
