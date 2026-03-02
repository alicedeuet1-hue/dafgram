"""Ajouter les tables time_categories et time_entries

Revision ID: 011_time_entries
Revises: 010_nullable_category
Create Date: 2024-01-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011_time_entries'
down_revision = '010_nullable_category'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer la table time_categories
    op.create_table(
        'time_categories',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color', sa.String(7), server_default='#8B5CF6'),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('position', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Créer la table time_entries
    op.create_table(
        'time_entries',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('time_categories.id'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Index pour les requêtes fréquentes
    op.create_index('ix_time_entries_company_date', 'time_entries', ['company_id', 'date'])
    op.create_index('ix_time_entries_category_date', 'time_entries', ['category_id', 'date'])
    op.create_index('ix_time_categories_company', 'time_categories', ['company_id'])


def downgrade() -> None:
    op.drop_index('ix_time_categories_company', table_name='time_categories')
    op.drop_index('ix_time_entries_category_date', table_name='time_entries')
    op.drop_index('ix_time_entries_company_date', table_name='time_entries')
    op.drop_table('time_entries')
    op.drop_table('time_categories')
