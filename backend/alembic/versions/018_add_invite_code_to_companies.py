"""Ajouter invite_code à la table companies

Revision ID: 018_invite_code
Revises: 017_payment_tables
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '018_invite_code'
down_revision = '017_payment_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter la colonne invite_code si elle n'existe pas
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('companies')]
    if 'invite_code' not in columns:
        op.add_column('companies', sa.Column('invite_code', sa.String(20), nullable=True))
        op.create_index('ix_companies_invite_code', 'companies', ['invite_code'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_companies_invite_code', table_name='companies')
    op.drop_column('companies', 'invite_code')
