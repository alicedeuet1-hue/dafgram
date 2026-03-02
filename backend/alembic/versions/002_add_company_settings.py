"""Add company_settings and bank_accounts tables for accounting customization

Revision ID: 002_company_settings
Revises: 001_client_update
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_company_settings'
down_revision = '001_client_update'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer la table company_settings
    op.create_table(
        'company_settings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False, unique=True),

        # Personnalisation visuelle
        sa.Column('primary_color', sa.String(7), server_default='#F5C518'),
        sa.Column('secondary_color', sa.String(7), server_default='#1A1A1A'),
        sa.Column('logo_url', sa.String(500), nullable=True),

        # Textes par défaut
        sa.Column('default_quote_terms', sa.Text(), nullable=True),
        sa.Column('default_invoice_terms', sa.Text(), nullable=True),
        sa.Column('default_quote_notes', sa.Text(), nullable=True),
        sa.Column('default_invoice_notes', sa.Text(), nullable=True),
        sa.Column('default_payment_terms', sa.String(500), nullable=True),

        # Numérotation automatique
        sa.Column('quote_prefix', sa.String(20), server_default='DEV-'),
        sa.Column('invoice_prefix', sa.String(20), server_default='FAC-'),
        sa.Column('quote_next_number', sa.Integer(), server_default='1'),
        sa.Column('invoice_next_number', sa.Integer(), server_default='1'),

        # Footer personnalisé
        sa.Column('document_footer', sa.Text(), nullable=True),

        # Métadonnées
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Index sur company_id
    op.create_index('ix_company_settings_company_id', 'company_settings', ['company_id'])

    # Créer la table bank_accounts pour les RIB multiples
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('company_settings_id', sa.Integer(), sa.ForeignKey('company_settings.id', ondelete='CASCADE'), nullable=False),

        # Informations du compte
        sa.Column('label', sa.String(100), nullable=True),
        sa.Column('bank_name', sa.String(200), nullable=True),
        sa.Column('account_holder', sa.String(200), nullable=True),
        sa.Column('iban', sa.String(50), nullable=True),
        sa.Column('bic', sa.String(20), nullable=True),

        # Compte par défaut
        sa.Column('is_default', sa.Boolean(), server_default='false'),

        # Ordre d'affichage
        sa.Column('position', sa.Integer(), server_default='0'),

        # Métadonnées
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Index sur company_settings_id
    op.create_index('ix_bank_accounts_company_settings_id', 'bank_accounts', ['company_settings_id'])


def downgrade() -> None:
    op.drop_index('ix_bank_accounts_company_settings_id', 'bank_accounts')
    op.drop_table('bank_accounts')
    op.drop_index('ix_company_settings_company_id', 'company_settings')
    op.drop_table('company_settings')
