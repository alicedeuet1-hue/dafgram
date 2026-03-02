"""Ajouter les tables de paiement Payzen

Revision ID: 017_payment_tables
Revises: 016_source_type
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017_payment_tables'
down_revision = '016_source_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer les types enum
    payment_status = sa.Enum('pending', 'authorized', 'captured', 'failed', 'refunded', 'cancelled', name='paymentstatus')
    payment_type = sa.Enum('setup_fee', 'subscription', 'combined', name='paymenttype')
    subscription_status = sa.Enum('trial', 'active', 'grace_period', 'suspended', 'cancelled', 'expired', name='subscriptionstatus')
    billing_cycle = sa.Enum('monthly', 'yearly', name='billingcycle')

    # Table payment_transactions
    op.create_table(
        'payment_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('payzen_transaction_id', sa.String(100), nullable=True),
        sa.Column('payzen_order_id', sa.String(100), nullable=True),
        sa.Column('form_token', sa.String(500), nullable=True),
        sa.Column('payment_type', payment_type, nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(10), server_default='XPF'),
        sa.Column('status', payment_status, server_default='pending'),
        sa.Column('billing_cycle', billing_cycle, nullable=True),
        sa.Column('period_start', sa.DateTime(), nullable=True),
        sa.Column('period_end', sa.DateTime(), nullable=True),
        sa.Column('error_code', sa.String(50), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('ipn_received', sa.Boolean(), server_default='false'),
        sa.Column('ipn_data', sa.Text(), nullable=True),
        sa.Column('ipn_signature_valid', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
    )
    op.create_index('ix_payment_transactions_payzen_transaction_id', 'payment_transactions', ['payzen_transaction_id'], unique=True)
    op.create_index('ix_payment_transactions_payzen_order_id', 'payment_transactions', ['payzen_order_id'], unique=False)

    # Table subscription_history
    op.create_table(
        'subscription_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('previous_status', subscription_status, nullable=True),
        sa.Column('new_status', subscription_status, nullable=False),
        sa.Column('reason', sa.String(200), nullable=True),
        sa.Column('payment_transaction_id', sa.Integer(), nullable=True),
        sa.Column('changed_at', sa.DateTime(), nullable=True),
        sa.Column('changed_by', sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['payment_transaction_id'], ['payment_transactions.id']),
    )

    # Table payment_retries
    op.create_table(
        'payment_retries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('original_transaction_id', sa.Integer(), nullable=False),
        sa.Column('retry_count', sa.Integer(), server_default='0'),
        sa.Column('max_retries', sa.Integer(), server_default='3'),
        sa.Column('next_retry_at', sa.DateTime(), nullable=True),
        sa.Column('grace_period_start', sa.DateTime(), nullable=True),
        sa.Column('grace_period_end', sa.DateTime(), nullable=True),
        sa.Column('email_notification_sent', sa.Boolean(), server_default='false'),
        sa.Column('sms_notification_sent', sa.Boolean(), server_default='false'),
        sa.Column('final_warning_sent', sa.Boolean(), server_default='false'),
        sa.Column('is_resolved', sa.Boolean(), server_default='false'),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolution_type', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['original_transaction_id'], ['payment_transactions.id']),
    )

    # Ajouter les colonnes à la table companies (batch mode pour SQLite)
    with op.batch_alter_table('companies', schema=None) as batch_op:
        batch_op.add_column(sa.Column('subscription_status', subscription_status, server_default='trial', nullable=False))
        batch_op.add_column(sa.Column('setup_fee_paid', sa.Boolean(), server_default='false'))
        batch_op.add_column(sa.Column('setup_fee_paid_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('last_payment_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('next_payment_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('grace_period_end', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('payzen_customer_id', sa.String(100), nullable=True))


def downgrade() -> None:
    # Supprimer les colonnes de companies
    with op.batch_alter_table('companies', schema=None) as batch_op:
        batch_op.drop_column('payzen_customer_id')
        batch_op.drop_column('grace_period_end')
        batch_op.drop_column('next_payment_at')
        batch_op.drop_column('last_payment_at')
        batch_op.drop_column('setup_fee_paid_at')
        batch_op.drop_column('setup_fee_paid')
        batch_op.drop_column('subscription_status')

    # Supprimer les tables
    op.drop_table('payment_retries')
    op.drop_table('subscription_history')
    op.drop_index('ix_payment_transactions_payzen_order_id', table_name='payment_transactions')
    op.drop_index('ix_payment_transactions_payzen_transaction_id', table_name='payment_transactions')
    op.drop_table('payment_transactions')
