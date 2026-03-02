"""
Routes de paiement - Intégration Payzen by OSB
"""
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    Company, User, PaymentTransaction, SubscriptionHistory, PaymentRetry,
    PaymentStatus, PaymentType, SubscriptionStatus, BillingCycle
)
from app.core.security import get_current_active_user
from app.core.config import settings
from app.services.payzen_service import payzen_service, PayzenAPIError
from app.schemas.payment import (
    CreatePaymentRequest, CreatePaymentResponse,
    PaymentSuccessRequest, SubscriptionStatusResponse,
    PaymentHistoryResponse, PricingResponse, PaymentWebhookResponse
)

router = APIRouter(tags=["payment"])


@router.get("/pricing", response_model=PricingResponse)
async def get_pricing():
    """Obtenir la tarification actuelle"""
    return PricingResponse(
        setup_fee=settings.SETUP_FEE_XPF,
        monthly_subscription=settings.MONTHLY_SUBSCRIPTION_XPF,
        yearly_subscription=settings.YEARLY_SUBSCRIPTION_XPF,
        yearly_savings=(settings.MONTHLY_SUBSCRIPTION_XPF * 12) - settings.YEARLY_SUBSCRIPTION_XPF,
        currency="XPF"
    )


@router.post("/create-payment", response_model=CreatePaymentResponse)
async def create_payment(
    request: CreatePaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Créer un formToken pour le paiement Payzen

    Types de paiement:
    - setup_fee: Frais de mise en place (100 000 XPF)
    - subscription: Abonnement mensuel (5 000 XPF) ou annuel (48 000 XPF)
    - combined: Mise en place + premier abonnement
    """
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    # Calculer le montant selon le type de paiement
    amount = 0
    if request.payment_type == PaymentType.SETUP_FEE:
        if company.setup_fee_paid:
            raise HTTPException(
                status_code=400,
                detail="Les frais de mise en place ont déjà été payés"
            )
        amount = settings.SETUP_FEE_XPF

    elif request.payment_type == PaymentType.SUBSCRIPTION:
        if not company.setup_fee_paid:
            raise HTTPException(
                status_code=400,
                detail="Les frais de mise en place doivent être payés d'abord"
            )
        amount = (
            settings.YEARLY_SUBSCRIPTION_XPF
            if request.billing_cycle == BillingCycle.YEARLY
            else settings.MONTHLY_SUBSCRIPTION_XPF
        )

    elif request.payment_type == PaymentType.COMBINED:
        if company.setup_fee_paid:
            raise HTTPException(
                status_code=400,
                detail="Les frais de mise en place ont déjà été payés, utilisez le type 'subscription'"
            )
        amount = settings.SETUP_FEE_XPF
        amount += (
            settings.YEARLY_SUBSCRIPTION_XPF
            if request.billing_cycle == BillingCycle.YEARLY
            else settings.MONTHLY_SUBSCRIPTION_XPF
        )

    # Générer un ID de commande unique
    order_id = f"DAF-{company.id}-{uuid.uuid4().hex[:8].upper()}"

    # Créer l'enregistrement de transaction (en attente)
    transaction = PaymentTransaction(
        company_id=company.id,
        payment_type=request.payment_type,
        amount=amount,
        currency="XPF",
        status=PaymentStatus.PENDING,
        billing_cycle=request.billing_cycle,
        payzen_order_id=order_id
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    # Créer le paiement Payzen avec redirection
    try:
        # Construire les URLs de retour
        base_url = settings.PAYMENT_SUCCESS_URL.rsplit('/', 1)[0]  # Enlever /success
        return_url = f"{base_url}/success?order_id={order_id}"
        cancel_url = f"{base_url}/cancel?order_id={order_id}"

        payzen_response = await payzen_service.create_payment_order(
            amount=amount,
            order_id=order_id,
            customer_email=company.email or current_user.email,
            customer_reference=str(company.id),
            description=f"DafGram - {request.payment_type.value}",
            return_url=return_url,
            cancel_url=cancel_url,
            ipn_url=settings.PAYMENT_IPN_URL,
            metadata={
                "transaction_id": transaction.id,
                "company_id": company.id,
                "payment_type": request.payment_type.value,
                "billing_cycle": request.billing_cycle.value if request.billing_cycle else None
            }
        )

        # Mettre à jour la transaction avec l'URL de paiement
        payment_url = payzen_response.get("paymentURL")
        transaction.form_token = payment_url  # Réutiliser ce champ pour stocker l'URL
        db.commit()

        return CreatePaymentResponse(
            payment_url=payment_url,
            transaction_id=transaction.id,
            amount=amount,
            order_id=order_id
        )

    except PayzenAPIError as e:
        transaction.status = PaymentStatus.FAILED
        transaction.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur du service de paiement: {str(e)}"
        )


@router.post("/ipn", response_model=PaymentWebhookResponse)
async def handle_ipn(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Gérer l'IPN (Instant Payment Notification) de Payzen

    Appelé serveur-à-serveur par Payzen pour confirmer le statut du paiement
    """
    # Récupérer le body brut pour la vérification de signature
    body = await request.body()
    body_str = body.decode()

    # Récupérer la signature du header
    signature = request.headers.get("kr-hash", "")

    # Vérifier la signature
    if not payzen_service.verify_ipn_signature(body_str, signature):
        raise HTTPException(status_code=400, detail="Signature invalide")

    # Parser les données IPN
    try:
        ipn_data = json.loads(body_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Payload JSON invalide")

    # Extraire les infos de transaction
    order_id = ipn_data.get("orderDetails", {}).get("orderId")
    order_status = ipn_data.get("orderStatus")
    transactions = ipn_data.get("transactions", [])
    payzen_transaction_id = transactions[0].get("uuid") if transactions else None

    # Trouver notre transaction
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.payzen_order_id == order_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    # Mettre à jour la transaction
    transaction.ipn_received = True
    transaction.ipn_data = body_str
    transaction.ipn_signature_valid = True
    transaction.payzen_transaction_id = payzen_transaction_id

    # Traiter selon le statut
    if order_status == "PAID":
        transaction.status = PaymentStatus.CAPTURED
        transaction.completed_at = datetime.utcnow()

        # Activer l'abonnement en arrière-plan
        background_tasks.add_task(
            process_successful_payment,
            transaction.id,
            db
        )
    elif order_status in ["REFUSED", "ERROR"]:
        transaction.status = PaymentStatus.FAILED
        error_details = transactions[0].get("errorCode", "Inconnu") if transactions else "Inconnu"
        transaction.error_code = error_details
        transaction.error_message = transactions[0].get("errorMessage") if transactions else None

        # Traiter l'échec en arrière-plan
        background_tasks.add_task(
            process_failed_payment,
            transaction.id,
            db
        )

    db.commit()

    return PaymentWebhookResponse(status="received")


@router.post("/success")
async def handle_payment_success(
    request: PaymentSuccessRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Gérer le retour navigateur après un paiement réussi

    Note: Ceci est pour l'UX. La confirmation réelle vient de l'IPN.
    """
    # Parser kr-answer
    try:
        payment_result = payzen_service.parse_kr_answer(request.kr_answer)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Réponse de paiement invalide: {str(e)}"
        )

    order_id = payment_result.get("orderDetails", {}).get("orderId")

    # Trouver la transaction
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.payzen_order_id == order_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    # Vérifier si l'IPN a déjà traité ce paiement
    if transaction.ipn_received and transaction.status == PaymentStatus.CAPTURED:
        return {"status": "success", "message": "Paiement confirmé"}

    # Si l'IPN n'est pas encore arrivé, afficher en attente
    return {"status": "pending", "message": "Paiement en cours de traitement"}


@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Obtenir le statut actuel de l'abonnement"""
    company = db.query(Company).filter(Company.id == current_user.company_id).first()

    return SubscriptionStatusResponse(
        subscription_status=company.subscription_status,
        subscription_plan=company.subscription_plan,
        billing_cycle=company.billing_cycle,
        setup_fee_paid=company.setup_fee_paid,
        subscription_start=company.subscription_start,
        subscription_end=company.subscription_end,
        next_payment_at=company.next_payment_at,
        grace_period_end=company.grace_period_end,
        is_in_grace_period=company.subscription_status == SubscriptionStatus.GRACE_PERIOD,
        days_until_suspension=_calculate_days_until_suspension(company)
    )


@router.get("/history", response_model=List[PaymentHistoryResponse])
async def get_payment_history(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    limit: int = 20
):
    """Obtenir l'historique des paiements"""
    transactions = db.query(PaymentTransaction).filter(
        PaymentTransaction.company_id == current_user.company_id
    ).order_by(PaymentTransaction.created_at.desc()).limit(limit).all()

    return transactions


# ==================== FONCTIONS HELPER ====================

def _calculate_days_until_suspension(company: Company) -> Optional[int]:
    """Calculer le nombre de jours avant suspension"""
    if company.subscription_status == SubscriptionStatus.GRACE_PERIOD and company.grace_period_end:
        delta = company.grace_period_end - datetime.utcnow()
        return max(0, delta.days)
    return None


async def process_successful_payment(transaction_id: int, db: Session):
    """Traiter un paiement réussi - activer/renouveler l'abonnement"""
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.id == transaction_id
    ).first()

    if not transaction:
        return

    company = db.query(Company).filter(Company.id == transaction.company_id).first()
    if not company:
        return

    now = datetime.utcnow()

    # Gérer les frais de mise en place
    if transaction.payment_type in [PaymentType.SETUP_FEE, PaymentType.COMBINED]:
        company.setup_fee_paid = True
        company.setup_fee_paid_at = now

    # Gérer l'abonnement
    if transaction.payment_type in [PaymentType.SUBSCRIPTION, PaymentType.COMBINED]:
        # Définir les dates d'abonnement
        if transaction.billing_cycle == BillingCycle.YEARLY:
            period_end = now + timedelta(days=365)
        else:
            period_end = now + timedelta(days=30)

        company.subscription_start = now
        company.subscription_end = period_end
        company.billing_cycle = transaction.billing_cycle
        company.last_payment_at = now
        company.next_payment_at = period_end

        # Mettre à jour la période de la transaction
        transaction.period_start = now
        transaction.period_end = period_end

        # Mettre à jour le statut de l'abonnement
        old_status = company.subscription_status
        company.subscription_status = SubscriptionStatus.ACTIVE
        company.grace_period_end = None

        # Enregistrer le changement de statut
        history = SubscriptionHistory(
            company_id=company.id,
            previous_status=old_status,
            new_status=SubscriptionStatus.ACTIVE,
            reason="Paiement réussi",
            payment_transaction_id=transaction.id,
            changed_by="system"
        )
        db.add(history)

    # Résoudre les tentatives de paiement en attente
    pending_retries = db.query(PaymentRetry).filter(
        PaymentRetry.company_id == company.id,
        PaymentRetry.is_resolved == False
    ).all()

    for retry in pending_retries:
        retry.is_resolved = True
        retry.resolved_at = now
        retry.resolution_type = "payment_success"

    db.commit()


async def process_failed_payment(transaction_id: int, db: Session):
    """Traiter un paiement échoué - démarrer la période de grâce"""
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.id == transaction_id
    ).first()

    if not transaction:
        return

    company = db.query(Company).filter(Company.id == transaction.company_id).first()
    if not company:
        return

    now = datetime.utcnow()

    # Créer l'enregistrement de tentative de paiement
    retry = PaymentRetry(
        company_id=company.id,
        original_transaction_id=transaction.id,
        grace_period_start=now,
        grace_period_end=now + timedelta(days=settings.GRACE_PERIOD_DAYS)
    )
    db.add(retry)

    # Mettre à jour le statut de l'entreprise en période de grâce
    old_status = company.subscription_status
    company.subscription_status = SubscriptionStatus.GRACE_PERIOD
    company.grace_period_end = retry.grace_period_end

    # Enregistrer le changement de statut
    history = SubscriptionHistory(
        company_id=company.id,
        previous_status=old_status,
        new_status=SubscriptionStatus.GRACE_PERIOD,
        reason=f"Paiement échoué: {transaction.error_code}",
        payment_transaction_id=transaction.id,
        changed_by="system"
    )
    db.add(history)

    db.commit()

    # TODO: Envoyer notification email/SMS
    # await send_payment_failure_notification(company, retry)
