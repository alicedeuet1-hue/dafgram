"""Schémas pour les entreprises"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CompanyBase(BaseModel):
    name: str
    slug: str


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class CompanyResponse(CompanyBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Bank Accounts ============

class BankAccountBase(BaseModel):
    label: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    is_default: bool = False
    position: int = 0


class BankAccountCreate(BankAccountBase):
    pass


class BankAccountUpdate(BankAccountBase):
    pass


class BankAccountResponse(BankAccountBase):
    id: int
    company_settings_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Company Settings ============

class CompanySettingsBase(BaseModel):
    # Personnalisation visuelle
    primary_color: Optional[str] = "#F5C518"
    secondary_color: Optional[str] = "#1A1A1A"
    text_color: Optional[str] = "#FFFFFF"
    logo_url: Optional[str] = None

    # Textes par défaut
    default_quote_terms: Optional[str] = None
    default_invoice_terms: Optional[str] = None
    default_quote_notes: Optional[str] = None
    default_invoice_notes: Optional[str] = None
    default_payment_terms: Optional[str] = None

    # Numérotation
    quote_prefix: Optional[str] = "DEV-"
    invoice_prefix: Optional[str] = "FAC-"
    quote_next_number: Optional[int] = 1
    invoice_next_number: Optional[int] = 1

    # Footer
    document_footer: Optional[str] = None

    # Configuration SMTP
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None

    # Messages d'email par défaut
    default_invoice_email_message: Optional[str] = None
    default_quote_email_message: Optional[str] = None


class CompanySettingsCreate(CompanySettingsBase):
    pass


class CompanySettingsUpdate(CompanySettingsBase):
    pass


class CompanySettingsResponse(CompanySettingsBase):
    id: int
    company_id: int
    bank_accounts: list[BankAccountResponse] = []
    smtp_configured: bool = False  # Indique si SMTP est configuré (sans exposer le mot de passe)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_smtp_status(cls, obj):
        """Créer une réponse avec le statut SMTP sans exposer le mot de passe"""
        data = {
            'id': obj.id,
            'company_id': obj.company_id,
            'primary_color': obj.primary_color,
            'secondary_color': obj.secondary_color,
            'text_color': obj.text_color,
            'logo_url': obj.logo_url,
            'default_quote_terms': obj.default_quote_terms,
            'default_invoice_terms': obj.default_invoice_terms,
            'default_quote_notes': obj.default_quote_notes,
            'default_invoice_notes': obj.default_invoice_notes,
            'default_payment_terms': obj.default_payment_terms,
            'quote_prefix': obj.quote_prefix,
            'invoice_prefix': obj.invoice_prefix,
            'quote_next_number': obj.quote_next_number,
            'invoice_next_number': obj.invoice_next_number,
            'document_footer': obj.document_footer,
            'smtp_host': obj.smtp_host,
            'smtp_port': obj.smtp_port,
            'smtp_user': obj.smtp_user,
            'smtp_password': '********' if obj.smtp_password else None,  # Masquer le mot de passe
            'smtp_from_email': obj.smtp_from_email,
            'smtp_from_name': obj.smtp_from_name,
            'default_invoice_email_message': obj.default_invoice_email_message,
            'default_quote_email_message': obj.default_quote_email_message,
            'smtp_configured': bool(obj.smtp_host and obj.smtp_user and obj.smtp_password),
            'bank_accounts': obj.bank_accounts,
            'created_at': obj.created_at,
            'updated_at': obj.updated_at,
        }
        return cls(**data)
