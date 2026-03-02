"""Schémas pour les employés et objectifs"""
from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import Optional
from app.db.models import PeriodType


class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    position: Optional[str] = None
    hired_date: Optional[date] = None
    color: Optional[str] = "#8B5CF6"


class EmployeeCreate(EmployeeBase):
    company_id: int
    user_id: Optional[int] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    position: Optional[str] = None
    is_active: Optional[bool] = None
    hired_date: Optional[date] = None
    color: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: int
    company_id: int
    user_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesGoalBase(BaseModel):
    target_amount: float
    period_type: PeriodType
    period_start: date
    period_end: date
    description: Optional[str] = None


class SalesGoalCreate(SalesGoalBase):
    employee_id: int


class SalesGoalUpdate(BaseModel):
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    period_type: Optional[PeriodType] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    description: Optional[str] = None


class SalesGoalResponse(SalesGoalBase):
    id: int
    employee_id: int
    current_amount: float
    progress_percentage: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
