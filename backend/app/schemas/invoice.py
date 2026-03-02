"""Schémas Pydantic pour les factures et devis"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


# ============ Line Items ============

class LineItemBase(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    vat_rate: float = 0.0  # Taux de TVA par ligne
    position: int = 0


class LineItemCreate(LineItemBase):
    pass


class LineItemUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    vat_rate: Optional[float] = None
    position: Optional[int] = None


class LineItemResponse(LineItemBase):
    id: int
    amount: float
    vat_amount: float = 0.0
    amount_with_vat: float = 0.0

    class Config:
        from_attributes = True


# ============ Invoice Payments ============

class InvoicePaymentBase(BaseModel):
    amount: float
    payment_date: date
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class InvoicePaymentCreate(InvoicePaymentBase):
    transaction_id: Optional[int] = None


class InvoicePaymentResponse(InvoicePaymentBase):
    id: int
    invoice_id: int
    transaction_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Invoices ============

class InvoiceBase(BaseModel):
    client_id: Optional[int] = None
    issue_date: date
    due_date: date
    description: Optional[str] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    tax_rate: float = 0.0


class InvoiceCreate(InvoiceBase):
    line_items: List[LineItemCreate] = []


class InvoiceUpdate(BaseModel):
    client_id: Optional[int] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    tax_rate: Optional[float] = None


class InvoiceResponse(InvoiceBase):
    id: int
    company_id: int
    invoice_number: str
    status: str
    subtotal: float
    tax_amount: float
    total_amount: float
    paid_amount: float
    quote_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    line_items: List[LineItemResponse] = []
    payments: List[InvoicePaymentResponse] = []
    client_name: Optional[str] = None
    client_email: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    id: int
    company_id: int
    invoice_number: str
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    issue_date: date
    due_date: date
    status: str
    total_amount: float
    paid_amount: float
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Quotes ============

class QuoteBase(BaseModel):
    client_id: Optional[int] = None
    issue_date: date
    valid_until: date
    description: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    tax_rate: float = 0.0


class QuoteCreate(QuoteBase):
    line_items: List[LineItemCreate] = []


class QuoteUpdate(BaseModel):
    client_id: Optional[int] = None
    issue_date: Optional[date] = None
    valid_until: Optional[date] = None
    status: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    tax_rate: Optional[float] = None


class QuoteLineItemResponse(LineItemBase):
    id: int
    amount: float
    vat_amount: float = 0.0
    amount_with_vat: float = 0.0

    class Config:
        from_attributes = True


class QuoteResponse(QuoteBase):
    id: int
    company_id: int
    quote_number: str
    status: str
    subtotal: float
    tax_amount: float
    total_amount: float
    created_at: datetime
    updated_at: datetime
    line_items: List[QuoteLineItemResponse] = []
    client_name: Optional[str] = None

    class Config:
        from_attributes = True


class QuoteListResponse(BaseModel):
    id: int
    company_id: int
    quote_number: str
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    issue_date: date
    valid_until: date
    status: str
    total_amount: float
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Convert Quote to Invoice ============

class QuoteToInvoiceRequest(BaseModel):
    due_date: date
    payment_terms: Optional[str] = None
