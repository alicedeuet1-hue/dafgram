"""
Routes GDPR - Export de données, suppression de compte, informations de confidentialité
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any

from app.db.database import get_db
from app.db.models import (
    User, Company, UserCompany, UserCompanyRole, CompanySettings, BankAccount,
    Budget, Transaction, Employee, SalesGoal, TimeCategory, TimeEntry,
    Document, Category, CategoryRule, BudgetCategory, BankImport,
    Client, ClientAttachment, SavingsCategory, VatRate,
    Invoice, InvoiceLineItem, InvoicePayment,
    Quote, QuoteLineItem,
    PaymentRetry, SubscriptionHistory, PaymentTransaction,
)
from app.core.security import get_current_active_user

router = APIRouter(tags=["gdpr"])


class DeleteAccountRequest(BaseModel):
    confirm: str


@router.get("/export")
async def export_user_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Export all user data as JSON (GDPR Article 20 - Right to data portability).
    Returns user profile, owned companies, and all associated data.
    """
    # User profile
    user_profile = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "role": current_user.role.value if current_user.role else None,
        "is_active": current_user.is_active,
        "avatar_url": current_user.avatar_url,
    }

    # Get all companies the user owns
    owned_user_companies = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.role == UserCompanyRole.OWNER
    ).all()

    owned_company_ids = [uc.company_id for uc in owned_user_companies]

    companies_data = []
    for company_id in owned_company_ids:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            continue

        # Transactions
        transactions = db.query(Transaction).filter(
            Transaction.company_id == company_id
        ).all()
        transactions_data = [
            {
                "id": t.id,
                "type": t.type.value if t.type else None,
                "amount": t.amount,
                "description": t.description,
                "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
                "category": t.category,
                "category_id": t.category_id,
                "account_type": t.account_type.value if t.account_type else None,
                "auto_imported": t.auto_imported,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions
        ]

        # Budget categories
        budget_categories = db.query(BudgetCategory).filter(
            BudgetCategory.company_id == company_id
        ).all()
        budget_categories_data = [
            {
                "id": bc.id,
                "category_id": bc.category_id,
                "percentage": bc.percentage,
                "allocated_amount": bc.allocated_amount,
                "spent_amount": bc.spent_amount,
                "is_savings": bc.is_savings,
                "period_month": bc.period_month,
                "period_year": bc.period_year,
            }
            for bc in budget_categories
        ]

        # Savings categories
        savings_categories = db.query(SavingsCategory).filter(
            SavingsCategory.company_id == company_id
        ).all()
        savings_categories_data = [
            {
                "id": sc.id,
                "name": sc.name,
                "description": sc.description,
                "color": sc.color,
                "percentage": sc.percentage,
                "is_default": sc.is_default,
            }
            for sc in savings_categories
        ]

        # Category rules
        category_rules = db.query(CategoryRule).filter(
            CategoryRule.company_id == company_id
        ).all()
        category_rules_data = [
            {
                "id": cr.id,
                "pattern": cr.pattern,
                "match_type": cr.match_type,
                "category_id": cr.category_id,
                "priority": cr.priority,
                "is_active": cr.is_active,
            }
            for cr in category_rules
        ]

        # Categories
        categories = db.query(Category).filter(
            Category.company_id == company_id
        ).all()
        categories_data = [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type.value if c.type else None,
                "color": c.color,
                "parent_id": c.parent_id,
                "is_active": c.is_active,
            }
            for c in categories
        ]

        companies_data.append({
            "id": company.id,
            "name": company.name,
            "slug": company.slug,
            "email": company.email,
            "phone": company.phone,
            "address": company.address,
            "city": company.city,
            "postal_code": company.postal_code,
            "country": company.country,
            "currency": company.currency,
            "account_type": company.account_type.value if company.account_type else None,
            "created_at": company.created_at.isoformat() if company.created_at else None,
            "transactions": transactions_data,
            "budget_categories": budget_categories_data,
            "savings_categories": savings_categories_data,
            "category_rules": category_rules_data,
            "categories": categories_data,
        })

    # All company memberships (including non-owned)
    all_memberships = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id
    ).all()
    memberships_data = [
        {
            "company_id": uc.company_id,
            "role": uc.role.value if uc.role else None,
            "is_default": uc.is_default,
            "created_at": uc.created_at.isoformat() if uc.created_at else None,
        }
        for uc in all_memberships
    ]

    return {
        "export_date": __import__("datetime").datetime.utcnow().isoformat(),
        "user": user_profile,
        "owned_companies": companies_data,
        "company_memberships": memberships_data,
    }


@router.delete("/delete-account")
async def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete user account and all associated data (GDPR Article 17 - Right to erasure).
    Requires confirmation body: {"confirm": "DELETE MY ACCOUNT"}
    """
    if body.confirm != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Confirmation required. Send {"confirm": "DELETE MY ACCOUNT"} to proceed.'
        )

    # Get all companies the user owns
    owned_user_companies = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.role == UserCompanyRole.OWNER
    ).all()

    owned_company_ids = [uc.company_id for uc in owned_user_companies]

    try:
        # Delete all data from each owned company
        for company_id in owned_company_ids:
            # --- Tables linked via parent IDs (no direct company_id) ---

            # invoice_line_items & invoice_payments via invoices
            invoice_ids = [i.id for i in db.query(Invoice).filter(Invoice.company_id == company_id).all()]
            if invoice_ids:
                db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id.in_(invoice_ids)).delete(synchronize_session=False)
                db.query(InvoicePayment).filter(InvoicePayment.invoice_id.in_(invoice_ids)).delete(synchronize_session=False)

            # quote_line_items via quotes
            quote_ids = [q.id for q in db.query(Quote).filter(Quote.company_id == company_id).all()]
            if quote_ids:
                db.query(QuoteLineItem).filter(QuoteLineItem.quote_id.in_(quote_ids)).delete(synchronize_session=False)

            # client_attachments via clients
            client_ids = [c.id for c in db.query(Client).filter(Client.company_id == company_id).all()]
            if client_ids:
                db.query(ClientAttachment).filter(ClientAttachment.client_id.in_(client_ids)).delete(synchronize_session=False)

            # sales_goals via employees
            employee_ids = [e.id for e in db.query(Employee).filter(Employee.company_id == company_id).all()]
            if employee_ids:
                db.query(SalesGoal).filter(SalesGoal.employee_id.in_(employee_ids)).delete(synchronize_session=False)

            # bank_accounts via company_settings
            company_settings = db.query(CompanySettings).filter(CompanySettings.company_id == company_id).first()
            if company_settings:
                db.query(BankAccount).filter(BankAccount.company_settings_id == company_settings.id).delete(synchronize_session=False)

            # --- Tables with direct company_id (children first) ---
            db.query(Transaction).filter(Transaction.company_id == company_id).delete(synchronize_session=False)
            db.query(BudgetCategory).filter(BudgetCategory.company_id == company_id).delete(synchronize_session=False)
            db.query(SavingsCategory).filter(SavingsCategory.company_id == company_id).delete(synchronize_session=False)
            db.query(CategoryRule).filter(CategoryRule.company_id == company_id).delete(synchronize_session=False)
            db.query(BankImport).filter(BankImport.company_id == company_id).delete(synchronize_session=False)
            db.query(Category).filter(Category.company_id == company_id).delete(synchronize_session=False)
            db.query(Budget).filter(Budget.company_id == company_id).delete(synchronize_session=False)
            db.query(TimeEntry).filter(TimeEntry.company_id == company_id).delete(synchronize_session=False)
            db.query(TimeCategory).filter(TimeCategory.company_id == company_id).delete(synchronize_session=False)
            db.query(Employee).filter(Employee.company_id == company_id).delete(synchronize_session=False)
            db.query(Document).filter(Document.company_id == company_id).delete(synchronize_session=False)
            db.query(PaymentRetry).filter(PaymentRetry.company_id == company_id).delete(synchronize_session=False)
            db.query(SubscriptionHistory).filter(SubscriptionHistory.company_id == company_id).delete(synchronize_session=False)
            db.query(PaymentTransaction).filter(PaymentTransaction.company_id == company_id).delete(synchronize_session=False)
            db.query(Invoice).filter(Invoice.company_id == company_id).delete(synchronize_session=False)
            db.query(Quote).filter(Quote.company_id == company_id).delete(synchronize_session=False)
            db.query(Client).filter(Client.company_id == company_id).delete(synchronize_session=False)
            db.query(VatRate).filter(VatRate.company_id == company_id).delete(synchronize_session=False)

            if company_settings:
                db.query(CompanySettings).filter(CompanySettings.id == company_settings.id).delete(synchronize_session=False)

            # Remove all UserCompany entries for this company (all members)
            db.query(UserCompany).filter(UserCompany.company_id == company_id).delete(synchronize_session=False)

            # Delete the company itself
            db.query(Company).filter(Company.id == company_id).delete(synchronize_session=False)

        # Remove UserCompany entries where user is a member (non-owned companies)
        db.query(UserCompany).filter(UserCompany.user_id == current_user.id).delete(synchronize_session=False)

        # Delete the user
        db.query(User).filter(User.id == current_user.id).delete(synchronize_session=False)

        db.commit()

        return {
            "message": "Account and all associated data have been permanently deleted.",
            "deleted_companies": len(owned_company_ids),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while deleting your account: {str(e)}"
        )


@router.get("/privacy-info")
async def get_privacy_info():
    """
    Return privacy information about data collection, usage, and access (GDPR Article 13/14).
    """
    return {
        "data_we_collect": {
            "account_information": [
                "Email address",
                "Full name",
                "Password (stored securely as a hash, never in plain text)",
                "Profile picture (optional)",
            ],
            "company_information": [
                "Company name, address, and contact details",
                "VAT number and registration number",
                "Logo (optional)",
            ],
            "financial_data": [
                "Transactions (revenues and expenses)",
                "Budget allocations and categories",
                "Savings categories and goals",
                "Bank import history (file metadata, not raw bank credentials)",
                "Invoices and quotes",
            ],
            "usage_data": [
                "Time tracking entries",
                "Category rules for automatic classification",
                "Employee records (for business accounts)",
            ],
        },
        "how_we_use_it": {
            "primary_purposes": [
                "Providing the DafGram accounting and budget management service",
                "Generating financial reports and dashboards",
                "Automatic categorization of transactions",
                "Invoice and quote generation",
            ],
            "technical_purposes": [
                "Authentication and account security",
                "Service improvement and bug fixing",
                "Subscription and payment processing",
            ],
        },
        "who_has_access": {
            "your_data": "Only you and members of your company spaces (based on roles) can access your data.",
            "company_roles": {
                "owner": "Full access to all company data",
                "admin": "Full access to all company data",
                "manager": "Access to operational data (transactions, budgets, employees)",
                "member": "Limited access based on assigned permissions",
            },
            "third_parties": [
                "Payment processor (Payzen) for subscription billing - limited to payment data only",
                "Cloud hosting provider - data encrypted at rest and in transit",
            ],
            "we_never": [
                "Sell your data to third parties",
                "Share your financial data with advertisers",
                "Access your data without a legitimate business reason",
            ],
        },
        "your_rights": {
            "access": "GET /api/gdpr/export - Download all your data",
            "erasure": "DELETE /api/gdpr/delete-account - Permanently delete your account and data",
            "portability": "GET /api/gdpr/export - Export your data in JSON format",
            "rectification": "You can update your profile and company information at any time through the application",
            "restriction": "Contact support to request restriction of processing",
            "objection": "Contact support to object to specific data processing",
        },
        "data_retention": {
            "active_accounts": "Data is retained as long as your account is active.",
            "deleted_accounts": "All data is permanently deleted immediately upon account deletion.",
            "backups": "Backups containing deleted data are purged within 30 days.",
        },
        "contact": {
            "email": "privacy@dafgram.com",
            "subject": "For any privacy-related inquiries or to exercise your rights",
        },
    }
