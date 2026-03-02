"""Schémas pour les paiements et abonnements Payzen"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.db.models import PaymentType, PaymentStatus, BillingCycle, SubscriptionStatus, SubscriptionPlan


class CreatePaymentRequest(BaseModel):
    """Requête pour créer un paiement"""
    payment_type: PaymentType
    billing_cycle: Optional[BillingCycle] = BillingCycle.MONTHLY


class CreatePaymentResponse(BaseModel):
    """Réponse avec l'URL de paiement Payzen"""
    payment_url: str  # URL de redirection vers Payzen
    transaction_id: int
    amount: int  # Montant en XPF
    order_id: str


class PaymentSuccessRequest(BaseModel):
    """Requête après retour navigateur du paiement"""
    kr_answer: str  # Paramètre kr-answer encodé base64
    kr_hash: Optional[str] = None  # Hash pour vérification


class PaymentIPNData(BaseModel):
    """Données IPN Payzen (structure flexible)"""
    class Config:
        extra = "allow"


class SubscriptionStatusResponse(BaseModel):
    """Statut complet de l'abonnement"""
    subscription_status: SubscriptionStatus
    subscription_plan: SubscriptionPlan
    billing_cycle: Optional[BillingCycle] = None
    setup_fee_paid: bool
    subscription_start: Optional[datetime] = None
    subscription_end: Optional[datetime] = None
    next_payment_at: Optional[datetime] = None
    grace_period_end: Optional[datetime] = None
    is_in_grace_period: bool
    days_until_suspension: Optional[int] = None


class PaymentHistoryResponse(BaseModel):
    """Historique des paiements"""
    id: int
    payment_type: PaymentType
    amount: int
    currency: str
    status: PaymentStatus
    billing_cycle: Optional[BillingCycle] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class PricingResponse(BaseModel):
    """Tarification actuelle"""
    setup_fee: int  # Frais de mise en place en XPF
    monthly_subscription: int  # Abonnement mensuel en XPF
    yearly_subscription: int  # Abonnement annuel en XPF
    yearly_savings: int  # Économie annuelle
    currency: str = "XPF"


class PaymentWebhookResponse(BaseModel):
    """Réponse standard pour les webhooks"""
    status: str
    message: Optional[str] = None


class RetryPaymentRequest(BaseModel):
    """Requête pour réessayer un paiement échoué"""
    transaction_id: int


class CancelSubscriptionRequest(BaseModel):
    """Requête pour annuler un abonnement"""
    reason: Optional[str] = None
