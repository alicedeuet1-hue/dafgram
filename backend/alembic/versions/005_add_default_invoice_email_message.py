"""Add default_invoice_email_message to company_settings

Revision ID: 005_invoice_email_msg
Revises: 004_smtp_settings
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_invoice_email_msg'
down_revision = '004_smtp_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter le champ pour le message d'email par défaut des factures
    op.add_column('company_settings', sa.Column('default_invoice_email_message', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('company_settings', 'default_invoice_email_message')
