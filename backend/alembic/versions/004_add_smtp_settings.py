"""Add SMTP settings to company_settings

Revision ID: 004_smtp_settings
Revises: 003_text_color
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_smtp_settings'
down_revision = '003_text_color'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter les colonnes SMTP pour la configuration email par entreprise
    op.add_column(
        'company_settings',
        sa.Column('smtp_host', sa.String(255), nullable=True)
    )
    op.add_column(
        'company_settings',
        sa.Column('smtp_port', sa.Integer(), server_default='587', nullable=True)
    )
    op.add_column(
        'company_settings',
        sa.Column('smtp_user', sa.String(255), nullable=True)
    )
    op.add_column(
        'company_settings',
        sa.Column('smtp_password', sa.String(255), nullable=True)
    )
    op.add_column(
        'company_settings',
        sa.Column('smtp_from_email', sa.String(255), nullable=True)
    )
    op.add_column(
        'company_settings',
        sa.Column('smtp_from_name', sa.String(255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('company_settings', 'smtp_from_name')
    op.drop_column('company_settings', 'smtp_from_email')
    op.drop_column('company_settings', 'smtp_password')
    op.drop_column('company_settings', 'smtp_user')
    op.drop_column('company_settings', 'smtp_port')
    op.drop_column('company_settings', 'smtp_host')
