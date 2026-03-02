"""Add client_type, first_name to clients and create client_attachments table

Revision ID: 001_client_update
Revises:
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_client_update'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajouter les nouvelles colonnes à la table clients
    op.add_column('clients', sa.Column('client_type', sa.String(20), nullable=False, server_default='personal'))
    op.add_column('clients', sa.Column('first_name', sa.String(200), nullable=True))

    # Supprimer la colonne contact_name (remplacée par name + first_name)
    # Note: on garde les données existantes dans 'name'
    op.drop_column('clients', 'contact_name')

    # Créer la table client_attachments
    op.create_table(
        'client_attachments',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('stored_filename', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_type', sa.String(100), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Créer l'index sur client_id
    op.create_index('ix_client_attachments_client_id', 'client_attachments', ['client_id'])


def downgrade() -> None:
    # Supprimer la table client_attachments
    op.drop_index('ix_client_attachments_client_id', 'client_attachments')
    op.drop_table('client_attachments')

    # Restaurer la colonne contact_name
    op.add_column('clients', sa.Column('contact_name', sa.String(200), nullable=True))

    # Supprimer les nouvelles colonnes
    op.drop_column('clients', 'first_name')
    op.drop_column('clients', 'client_type')
