import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database - SQLite par défaut pour dev local, PostgreSQL pour Docker
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./dafgram.db"  # SQLite local par défaut
    )

    # JWT
    JWT_SECRET: str = "change_me_super_secret"
    JWT_EXPIRES_MIN: int = 120
    JWT_ALGORITHM: str = "HS256"

    # OAuth2
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback"

    # Encryption
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    # Application
    APP_NAME: str = "DafGram"
    API_VERSION: str = "0.1.0"

    # File uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # AWS S3
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "")
    AWS_S3_REGION: str = os.getenv("AWS_S3_REGION", "eu-west-3")

    # Payzen by OSB - Configuration paiement
    PAYZEN_SHOP_ID: str = os.getenv("PAYZEN_SHOP_ID", "")
    PAYZEN_PASSWORD: str = os.getenv("PAYZEN_PASSWORD", "")  # Mot de passe API REST
    PAYZEN_HMAC_KEY: str = os.getenv("PAYZEN_HMAC_KEY", "")  # Clé HMAC pour vérification signature
    PAYZEN_PUBLIC_KEY: str = os.getenv("PAYZEN_PUBLIC_KEY", "")  # Clé publique pour JS Client
    PAYZEN_API_URL: str = "https://secure.osb.pf/api-payment/V4/"
    PAYZEN_JS_CLIENT: str = "https://static.osb.pf/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js"

    # URLs de retour paiement
    PAYMENT_SUCCESS_URL: str = os.getenv("PAYMENT_SUCCESS_URL", "http://localhost:3000/payment/success")
    PAYMENT_ERROR_URL: str = os.getenv("PAYMENT_ERROR_URL", "http://localhost:3000/payment/error")
    PAYMENT_IPN_URL: str = os.getenv("PAYMENT_IPN_URL", "http://localhost:8000/api/payment/ipn")

    # Tarifs en XPF (Francs Pacifique)
    SETUP_FEE_XPF: int = 100000  # Frais de mise en place (unique)
    MONTHLY_SUBSCRIPTION_XPF: int = 5000  # Abonnement mensuel
    YEARLY_SUBSCRIPTION_XPF: int = 48000  # Abonnement annuel (-20%)

    # Période de grâce (en jours) après échec de paiement
    GRACE_PERIOD_DAYS: int = 2

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
