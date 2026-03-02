"""Add text_color column to company_settings

Revision ID: 003_text_color
Revises: 002_company_settings
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_text_color'
down_revision = '002_company_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter la colonne text_color pour le contraste de texte
    op.add_column(
        'company_settings',
        sa.Column('text_color', sa.String(7), server_default='#FFFFFF', nullable=True)
    )


def downgrade() -> None:
    op.drop_column('company_settings', 'text_color')
