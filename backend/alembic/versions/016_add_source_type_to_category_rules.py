"""Ajouter le champ source_type aux règles de catégorisation

Revision ID: 016_source_type
Revises: 015_name_changed
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016_source_type'
down_revision = '015_name_changed'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Utiliser batch operations pour SQLite
    with op.batch_alter_table('category_rules', schema=None) as batch_op:
        # Ajouter le champ source_type pour filtrer les règles par type de transaction
        batch_op.add_column(
            sa.Column('source_type', sa.Enum('revenue', 'expense', name='transactiontype'), nullable=True)
        )
        # Rendre le pattern nullable (optionnel si source_type est défini)
        batch_op.alter_column(
            'pattern',
            existing_type=sa.String(500),
            nullable=True
        )


def downgrade() -> None:
    with op.batch_alter_table('category_rules', schema=None) as batch_op:
        # Remettre pattern en non-nullable
        batch_op.alter_column(
            'pattern',
            existing_type=sa.String(500),
            nullable=False
        )
        batch_op.drop_column('source_type')
