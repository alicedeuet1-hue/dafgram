"""Add savings_categories table and savings_category_id to transactions

Revision ID: 009_savings_categories
Revises: 008_is_savings
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009_savings_categories'
down_revision = '008_is_savings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer la table savings_categories
    op.create_table(
        'savings_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color', sa.String(7), default='#F5C518'),
        sa.Column('percentage', sa.Float(), default=0.0),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_savings_categories_id', 'savings_categories', ['id'])
    op.create_index('ix_savings_categories_company_id', 'savings_categories', ['company_id'])

    # Ajouter la colonne savings_category_id aux transactions
    op.add_column('transactions', sa.Column(
        'savings_category_id',
        sa.Integer(),
        sa.ForeignKey('savings_categories.id'),
        nullable=True
    ))


def downgrade() -> None:
    # Supprimer la colonne savings_category_id des transactions
    op.drop_column('transactions', 'savings_category_id')

    # Supprimer les index
    op.drop_index('ix_savings_categories_company_id', table_name='savings_categories')
    op.drop_index('ix_savings_categories_id', table_name='savings_categories')

    # Supprimer la table savings_categories
    op.drop_table('savings_categories')
