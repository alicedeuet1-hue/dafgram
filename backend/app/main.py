from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import os
import logging
from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.budgets import router as budgets_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.employees import router as employees_router
# from app.api.routes.documents import router as documents_router  # Requires libmagic
from app.api.routes.companies import router as companies_router
from app.api.routes.bank_import import router as bank_import_router
from app.api.routes.budget_categories import router as budget_categories_router
from app.api.routes.clients import router as clients_router
# from app.api.routes.invoices import router as invoices_router  # Requires reportlab
# from app.api.routes.quotes import router as quotes_router  # Requires reportlab
from app.api.routes.vat_rates import router as vat_rates_router
from app.api.routes.savings_categories import router as savings_categories_router
from app.api.routes.time_entries import router as time_entries_router
from app.api.routes.payment import router as payment_router
from app.api.routes.files import router as files_router
from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.s3 import s3_enabled
    print(f"S3 enabled: {s3_enabled()}, bucket: '{settings.AWS_S3_BUCKET}', region: '{settings.AWS_S3_REGION}'")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    lifespan=lifespan,
    docs_url=None,      # Désactiver /docs en production
    redoc_url=None,      # Désactiver /redoc en production
    openapi_url=None,    # Désactiver /openapi.json en production
)


# Middleware de sécurité : ajoute les headers sur chaque réponse
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        # HSTS - Force HTTPS pendant 1 an, inclut les sous-domaines
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        # Protection clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Protection MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Permissions policy
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        # Cacher la version du serveur
        response.headers["X-Powered-By"] = ""
        response.headers["Server"] = "DafGram"
        # CSP pour l'API (restrictive)
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://frontend:3000",
        "https://dafgram.com",
        "https://www.dafgram.com",
        "https://app.dafgram.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Créer le dossier uploads s'il n'existe pas
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Servir les fichiers statiques (images uploadées)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Routes
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth")
app.include_router(budgets_router, prefix="/api/budgets")
app.include_router(transactions_router, prefix="/api/transactions")
app.include_router(employees_router, prefix="/api/employees")
# app.include_router(documents_router, prefix="/api/documents")  # Requires libmagic
app.include_router(companies_router, prefix="/api/companies")
app.include_router(bank_import_router, prefix="/api/bank")
app.include_router(budget_categories_router, prefix="/api/budget-categories")
app.include_router(clients_router, prefix="/api/clients")
# app.include_router(invoices_router, prefix="/api/invoices")  # Requires reportlab
# app.include_router(quotes_router, prefix="/api/quotes")  # Requires reportlab
app.include_router(vat_rates_router, prefix="/api/vat-rates")
app.include_router(savings_categories_router, prefix="/api/savings-categories")
app.include_router(time_entries_router, prefix="/api/time-entries")
app.include_router(payment_router, prefix="/api/payment")
app.include_router(files_router, prefix="/api")

@app.get("/")
def root():
    return {"status": "ok"}
