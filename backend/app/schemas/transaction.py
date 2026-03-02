"""Schémas pour les transactions"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.db.models import TransactionType, BankAccountType


class TransactionBase(BaseModel):
    type: TransactionType
    amount: float
    description: Optional[str] = None
    budget_id: Optional[int] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    savings_category_id: Optional[int] = None  # Catégorie d'épargne (si applicable)
    transaction_date: Optional[datetime] = None
    account_type: Optional[BankAccountType] = BankAccountType.COMPANY


class TransactionCreate(TransactionBase):
    company_id: int


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    budget_id: Optional[int] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    savings_category_id: Optional[int] = None  # Catégorie d'épargne (si applicable)
    transaction_date: Optional[datetime] = None
    account_type: Optional[BankAccountType] = None


class TransactionResponse(TransactionBase):
    id: int
    company_id: int
    source_file: Optional[str] = None
    auto_imported: bool
    reference_hash: Optional[str] = None
    bank_import_id: Optional[int] = None
    savings_category_id: Optional[int] = None  # Catégorie d'épargne
    account_type: BankAccountType
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransactionStats(BaseModel):
    """Statistiques des transactions"""
    total_revenue: float
    total_expenses: float
    net_balance: float
    transaction_count: int
