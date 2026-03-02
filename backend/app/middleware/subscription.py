"""
Middleware de vérification d'abonnement
Vérifie que l'entreprise a un abonnement actif avant d'autoriser l'accès
"""
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy.orm import Session

from app.db.models import Company, SubscriptionStatus


class SubscriptionChecker:
    """
    Vérifie le statut d'abonnement avant d'autoriser l'accès
    """

    # Routes exemptées de la vérification d'abonnement
    EXEMPT_ROUTES = [
        "/api/auth/",
        "/api/payment/",
        "/api/health",
        "/api/companies/me",  # Nécessaire pour afficher l'avertissement
    ]

    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def check_access(self) -> Dict:
        """
        Vérifie si l'entreprise a un accès valide

        Returns:
            dict avec:
            - allowed: bool - accès autorisé ou non
            - status: SubscriptionStatus - statut actuel
            - warning: Optional[str] - message d'avertissement si période de grâce
            - days_remaining: Optional[int] - jours avant suspension
            - error: Optional[str] - message d'erreur si accès refusé
        """
        company = self.db.query(Company).filter(Company.id == self.company_id).first()

        if not company:
            return {
                "allowed": False,
                "status": None,
                "error": "Entreprise non trouvée"
            }

        now = datetime.utcnow()

        # Vérifier le statut d'abonnement
        if company.subscription_status == SubscriptionStatus.ACTIVE:
            # Vérifier si l'abonnement a expiré
            if company.subscription_end and company.subscription_end < now:
                return {
                    "allowed": False,
                    "status": SubscriptionStatus.EXPIRED,
                    "error": "Votre abonnement a expiré. Veuillez renouveler pour continuer."
                }
            return {
                "allowed": True,
                "status": SubscriptionStatus.ACTIVE,
                "warning": None
            }

        elif company.subscription_status == SubscriptionStatus.GRACE_PERIOD:
            # Autoriser l'accès mais avec avertissement
            if company.grace_period_end and company.grace_period_end > now:
                days_remaining = (company.grace_period_end - now).days
                return {
                    "allowed": True,
                    "status": SubscriptionStatus.GRACE_PERIOD,
                    "warning": f"Votre paiement a échoué. Mettez à jour vos informations de paiement. Accès suspendu dans {days_remaining} jour(s).",
                    "days_remaining": days_remaining
                }
            else:
                # Période de grâce expirée
                return {
                    "allowed": False,
                    "status": SubscriptionStatus.SUSPENDED,
                    "error": "Votre période de grâce a expiré. Veuillez effectuer le paiement pour continuer."
                }

        elif company.subscription_status == SubscriptionStatus.TRIAL:
            # Les comptes d'essai ont accès (pour démo/test)
            return {
                "allowed": True,
                "status": SubscriptionStatus.TRIAL,
                "warning": "Vous êtes en période d'essai. Souscrivez pour continuer à utiliser DafGram."
            }

        elif company.subscription_status in [
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELLED,
            SubscriptionStatus.EXPIRED
        ]:
            return {
                "allowed": False,
                "status": company.subscription_status,
                "error": "Votre abonnement n'est pas actif. Veuillez souscrire pour accéder à l'application."
            }

        return {
            "allowed": False,
            "status": company.subscription_status,
            "error": "Statut d'abonnement inconnu"
        }


def is_route_exempt(path: str) -> bool:
    """
    Vérifie si une route est exemptée de la vérification d'abonnement

    Args:
        path: Chemin de la requête

    Returns:
        True si la route est exemptée
    """
    for exempt in SubscriptionChecker.EXEMPT_ROUTES:
        if path.startswith(exempt):
            return True
    return False


def check_subscription_status(
    path: str,
    company_id: int,
    db: Session
) -> Optional[Dict]:
    """
    Dépendance FastAPI pour vérifier le statut d'abonnement

    Args:
        path: Chemin de la requête
        company_id: ID de l'entreprise
        db: Session de base de données

    Returns:
        None si route exemptée, sinon dict avec le statut
    """
    if is_route_exempt(path):
        return None

    checker = SubscriptionChecker(db, company_id)
    return checker.check_access()
