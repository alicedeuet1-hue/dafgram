"""Schémas pour les budgets"""
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from app.db.models import PeriodType


class BudgetBase(BaseModel):
    name: str
    description: Optional[str] = None
    allocated_amount: float = 0.0
    percentage_allocation: float = 0.0
    period_type: PeriodType = PeriodType.MONTHLY
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    color: str = "#3B82F6"


class BudgetCreate(BudgetBase):
    company_id: int


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    allocated_amount: Optional[float] = None
    percentage_allocation: Optional[float] = None
    period_type: Optional[PeriodType] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class BudgetResponse(BudgetBase):
    id: int
    company_id: int
    spent_amount: float
    is_active: bool
    created_at: datetime
    updated_at: datetime
    remaining_amount: Optional[float] = None
    percentage_spent: Optional[float] = None

    class Config:
        from_attributes = True


class BudgetStats(BaseModel):
    """Statistiques pour la visualisation en camembert"""
    budget_id: int
    name: str
    allocated_amount: float
    spent_amount: float
    remaining_amount: float
    percentage_spent: float
    color: str
