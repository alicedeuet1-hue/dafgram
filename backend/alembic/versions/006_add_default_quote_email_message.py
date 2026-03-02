"""Add default_quote_email_message to company_settings

Revision ID: 006_quote_email_msg
Revises: 005_invoice_email_msg
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_quote_email_msg'
down_revision = '005_invoice_email_msg'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter le champ pour le message d'email par défaut des devis
    op.add_column('company_settings', sa.Column('default_quote_email_message', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('company_settings', 'default_quote_email_message')
