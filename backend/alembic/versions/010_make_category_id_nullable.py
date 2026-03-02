"""Make category_id nullable in budget_categories for savings budgets

Revision ID: 010_nullable_category
Revises: 009_savings_cats
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_nullable_category'
down_revision = '009_savings_categories'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rendre category_id nullable pour permettre les budgets d'épargne sans catégorie
    op.alter_column('budget_categories', 'category_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade() -> None:
    # Remettre category_id en non-nullable
    # Note: cela échouera si des lignes ont category_id NULL
    op.alter_column('budget_categories', 'category_id',
                    existing_type=sa.Integer(),
                    nullable=False)
