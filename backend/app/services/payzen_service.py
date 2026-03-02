"""
Service d'intégration Payzen by OSB pour les paiements
Documentation: https://api.osb.pf/api-payment/V4/
"""
import httpx
import base64
import hmac
import hashlib
import json
from datetime import datetime
from typing import Optional, Dict, Any
from app.core.config import settings


class PayzenAPIError(Exception):
    """Exception pour les erreurs de l'API Payzen"""
    def __init__(self, message: str, status_code: int = None, error_code: str = None):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(self.message)


class PayzenService:
    """Service pour interagir avec l'API Payzen by OSB"""

    def __init__(self):
        self.api_url = settings.PAYZEN_API_URL
        self.shop_id = settings.PAYZEN_SHOP_ID
        self.password = settings.PAYZEN_PASSWORD
        self.hmac_key = settings.PAYZEN_HMAC_KEY

    def _get_auth_header(self) -> str:
        """Génère le header Basic Auth"""
        credentials = f"{self.shop_id}:{self.password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    async def create_payment(
        self,
        amount: int,
        order_id: str,
        customer_email: str,
        customer_reference: str,
        description: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Crée un formToken pour le paiement via l'API Payzen

        Args:
            amount: Montant en XPF (entier, plus petite unité)
            order_id: Identifiant unique de la commande
            customer_email: Email du client pour le reçu
            customer_reference: ID entreprise ou référence client
            description: Description du paiement
            metadata: Données additionnelles à passer

        Returns:
            Dict contenant formToken et autres données

        Raises:
            PayzenAPIError: En cas d'erreur API
        """
        payload = {
            "amount": amount,
            "currency": "XPF",
            "orderId": order_id,
            "customer": {
                "email": customer_email,
                "reference": customer_reference
            },
            "transactionOptions": {
                "cardOptions": {
                    "paymentSource": "EC"  # E-commerce
                }
            },
            "metadata": metadata or {}
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.api_url}Charge/CreatePayment",
                    json=payload,
                    headers={
                        "Authorization": self._get_auth_header(),
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code != 200:
                    raise PayzenAPIError(
                        f"Erreur API Payzen: {response.status_code} - {response.text}",
                        status_code=response.status_code
                    )

                data = response.json()

                if data.get("status") != "SUCCESS":
                    error_msg = data.get("answer", {}).get("errorMessage", "Erreur inconnue")
                    error_code = data.get("answer", {}).get("errorCode", "UNKNOWN")
                    raise PayzenAPIError(
                        f"Création du paiement échouée: {error_msg}",
                        error_code=error_code
                    )

                return data["answer"]

            except httpx.RequestError as e:
                raise PayzenAPIError(f"Erreur de connexion à Payzen: {str(e)}")

    async def create_payment_order(
        self,
        amount: int,
        order_id: str,
        customer_email: str,
        customer_reference: str,
        description: str,
        return_url: str,
        cancel_url: str,
        ipn_url: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Crée une URL de paiement pour redirection vers Payzen

        Args:
            amount: Montant en XPF
            order_id: Identifiant unique de la commande
            customer_email: Email du client
            customer_reference: Référence client
            description: Description du paiement
            return_url: URL de retour après paiement
            cancel_url: URL en cas d'annulation
            ipn_url: URL IPN pour notification serveur
            metadata: Données additionnelles

        Returns:
            Dict contenant paymentURL
        """
        payload = {
            "amount": amount,
            "currency": "XPF",
            "orderId": order_id,
            "customer": {
                "email": customer_email,
                "reference": customer_reference
            },
            "formAction": "PAYMENT",
            "strongAuthentication": "AUTO",
            "redirectSuccessUrl": return_url,
            "redirectErrorUrl": cancel_url,
            "metadata": metadata or {}
        }

        # N'ajouter l'URL IPN que si elle est publiquement accessible (pas localhost)
        if ipn_url and "localhost" not in ipn_url and "127.0.0.1" not in ipn_url:
            payload["ipnTargetUrl"] = ipn_url

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.api_url}Charge/CreatePaymentOrder",
                    json=payload,
                    headers={
                        "Authorization": self._get_auth_header(),
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code != 200:
                    raise PayzenAPIError(
                        f"Erreur API Payzen: {response.status_code} - {response.text}",
                        status_code=response.status_code
                    )

                data = response.json()

                if data.get("status") != "SUCCESS":
                    error_msg = data.get("answer", {}).get("errorMessage", "Erreur inconnue")
                    error_code = data.get("answer", {}).get("errorCode", "UNKNOWN")
                    raise PayzenAPIError(
                        f"Création du paiement échouée: {error_msg}",
                        error_code=error_code
                    )

                return data["answer"]

            except httpx.RequestError as e:
                raise PayzenAPIError(f"Erreur de connexion à Payzen: {str(e)}")

    async def get_payment_details(self, order_id: str) -> Dict[str, Any]:
        """
        Récupère les détails d'un paiement

        Args:
            order_id: ID de la commande

        Returns:
            Dict avec les détails du paiement
        """
        payload = {
            "orderId": order_id
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.api_url}Order/Get",
                    json=payload,
                    headers={
                        "Authorization": self._get_auth_header(),
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code != 200:
                    raise PayzenAPIError(
                        f"Erreur API Payzen: {response.status_code}",
                        status_code=response.status_code
                    )

                data = response.json()
                return data.get("answer", {})

            except httpx.RequestError as e:
                raise PayzenAPIError(f"Erreur de connexion à Payzen: {str(e)}")

    def verify_ipn_signature(self, payload: str, received_signature: str) -> bool:
        """
        Vérifie la signature IPN avec HMAC-SHA-256

        Args:
            payload: Payload JSON brut de l'IPN
            received_signature: Signature reçue dans le header kr-hash

        Returns:
            True si la signature est valide
        """
        if not self.hmac_key:
            return False

        computed = hmac.new(
            self.hmac_key.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(computed.lower(), received_signature.lower())

    def verify_browser_return_signature(self, kr_answer: str, received_hash: str) -> bool:
        """
        Vérifie la signature du retour navigateur

        Args:
            kr_answer: Paramètre kr-answer du retour
            received_hash: Hash reçu dans kr-hash ou kr-hash-key

        Returns:
            True si la signature est valide
        """
        if not self.hmac_key:
            return False

        # Le kr-answer est signé avec la clé HMAC
        computed = hmac.new(
            self.hmac_key.encode(),
            kr_answer.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(computed.lower(), received_hash.lower())

    def parse_kr_answer(self, kr_answer: str) -> Dict[str, Any]:
        """
        Parse le paramètre kr-answer du retour navigateur

        Args:
            kr_answer: Paramètre kr-answer encodé en base64

        Returns:
            Dict avec le résultat du paiement
        """
        try:
            # kr-answer est encodé en base64
            decoded = base64.b64decode(kr_answer)
            return json.loads(decoded)
        except Exception as e:
            raise PayzenAPIError(f"Impossible de parser kr-answer: {str(e)}")

    def extract_transaction_info(self, ipn_data: Dict) -> Dict[str, Any]:
        """
        Extrait les informations importantes d'un IPN

        Args:
            ipn_data: Données IPN parsées

        Returns:
            Dict avec les infos clés (status, transaction_id, etc.)
        """
        transactions = ipn_data.get("transactions", [])
        first_transaction = transactions[0] if transactions else {}

        return {
            "order_id": ipn_data.get("orderDetails", {}).get("orderId"),
            "order_status": ipn_data.get("orderStatus"),
            "transaction_id": first_transaction.get("uuid"),
            "transaction_status": first_transaction.get("status"),
            "amount": ipn_data.get("orderDetails", {}).get("orderTotalAmount"),
            "currency": ipn_data.get("orderDetails", {}).get("orderCurrency"),
            "error_code": first_transaction.get("errorCode"),
            "error_message": first_transaction.get("errorMessage"),
            "created_at": ipn_data.get("serverDate")
        }


# Instance singleton du service
payzen_service = PayzenService()
