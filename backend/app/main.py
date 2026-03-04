from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from app.core.config import settings

logger = logging.getLogger(__name__)


def _migrate_personal_subcategories():
    """Ajouter les sous-catégories manquantes aux comptes personnels existants."""
    from app.db.database import SessionLocal
    from app.db.models import Company, AccountType, Category, TransactionType, BudgetCategory

    parent_categories = [
        {"name": "Quotidien", "color": "#3B82F6", "budget_pct": 50},
        {"name": "Plaisirs", "color": "#8B5CF6", "budget_pct": 30},
    ]

    subcategories = {
        "Quotidien": [
            {"name": "Loyer", "color": "#2563EB"},
            {"name": "Prêt", "color": "#1D4ED8"},
            {"name": "EDT", "color": "#F59E0B"},
            {"name": "Vini", "color": "#10B981"},
            {"name": "Internet", "color": "#8B5CF6"},
            {"name": "Courses Alimentaires", "color": "#EF4444"},
        ],
        "Plaisirs": [
            {"name": "Shopping", "color": "#EC4899"},
            {"name": "Restaurants", "color": "#F97316"},
            {"name": "Voyages", "color": "#06B6D4"},
        ],
    }

    db = SessionLocal()
    try:
        personal_companies = db.query(Company).filter(
            Company.account_type == AccountType.PERSONAL
        ).all()
        logger.info(f"Migration: found {len(personal_companies)} personal account(s)")

        for company in personal_companies:
            # Créer les catégories parentes si manquantes
            for pcat in parent_categories:
                parent = db.query(Category).filter(
                    Category.company_id == company.id,
                    Category.name == pcat["name"],
                    Category.type == TransactionType.EXPENSE,
                    Category.parent_id.is_(None),
                ).first()
                if not parent:
                    parent = Category(
                        company_id=company.id,
                        name=pcat["name"],
                        type=TransactionType.EXPENSE,
                        color=pcat["color"],
                    )
                    db.add(parent)
                    db.flush()
                    logger.info(f"Created parent category '{pcat['name']}' for company {company.id}")

                    # Créer le BudgetCategory associé
                    db.add(BudgetCategory(
                        company_id=company.id,
                        category_id=parent.id,
                        percentage=pcat["budget_pct"],
                        is_savings=False,
                        period_month=None,
                        period_year=None,
                    ))

            db.flush()

            # Créer les sous-catégories
            for parent_name, children in subcategories.items():
                parent = db.query(Category).filter(
                    Category.company_id == company.id,
                    Category.name == parent_name,
                    Category.type == TransactionType.EXPENSE,
                    Category.parent_id.is_(None),
                ).first()
                if not parent:
                    continue
                for sub in children:
                    exists = db.query(Category).filter(
                        Category.company_id == company.id,
                        Category.name == sub["name"],
                        Category.parent_id == parent.id,
                    ).first()
                    if not exists:
                        db.add(Category(
                            company_id=company.id,
                            name=sub["name"],
                            type=TransactionType.EXPENSE,
                            color=sub["color"],
                            parent_id=parent.id,
                        ))
                        logger.info(f"Created subcategory '{sub['name']}' under '{parent_name}' for company {company.id}")
        db.commit()
        logger.info("Migration completed successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Migration error: {e}", exc_info=True)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.s3 import s3_enabled
    logger.info(f"S3 enabled: {s3_enabled()}, bucket: '{settings.AWS_S3_BUCKET}', region: '{settings.AWS_S3_REGION}'")
    _migrate_personal_subcategories()
    yield


app = FastAPI(title=settings.APP_NAME, version=settings.API_VERSION, lifespan=lifespan)

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

@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.API_VERSION,
        "status": "ok"
    }
