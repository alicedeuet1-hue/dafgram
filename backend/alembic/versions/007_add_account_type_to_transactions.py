"""Add account_type to transactions for company vs associate account

Revision ID: 007_account_type
Revises: 006_quote_email_msg
Create Date: 2026-01-31

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_account_type'
down_revision = '006_quote_email_msg'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer le type enum pour PostgreSQL
    bankaccounttype = sa.Enum('company', 'associate', name='bankaccounttype')
    bankaccounttype.create(op.get_bind(), checkfirst=True)

    # Ajouter la colonne account_type nullable d'abord
    op.add_column('transactions', sa.Column(
        'account_type',
        sa.Enum('company', 'associate', name='bankaccounttype'),
        nullable=True
    ))

    # Mettre à jour toutes les transactions existantes avec 'company'
    op.execute("UPDATE transactions SET account_type = 'company' WHERE account_type IS NULL")

    # Rendre la colonne non-nullable avec valeur par défaut
    op.alter_column('transactions', 'account_type',
        nullable=False,
        server_default='company'
    )

    # Créer un index pour améliorer les performances des requêtes filtrées
    op.create_index('ix_transactions_account_type', 'transactions', ['account_type'])


def downgrade() -> None:
    # Supprimer l'index
    op.drop_index('ix_transactions_account_type', table_name='transactions')

    # Supprimer la colonne
    op.drop_column('transactions', 'account_type')

    # Supprimer le type enum
    sa.Enum(name='bankaccounttype').drop(op.get_bind(), checkfirst=True)
