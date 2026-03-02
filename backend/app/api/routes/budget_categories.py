"""
Routes pour la gestion des budgets par catégorie
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.db.models import (
    User, Company, Category, BudgetCategory, Transaction,
    TransactionType, PeriodType
)
from app.core.security import get_current_active_user

router = APIRouter(tags=["budget-categories"])


# Schemas
class BudgetCategoryCreate(BaseModel):
    category_id: Optional[int] = None  # Optionnel pour les budgets d'épargne
    percentage: float
    is_savings: bool = False  # True pour un budget d'épargne


class BudgetCategoryUpdate(BaseModel):
    percentage: Optional[float] = None
    is_savings: Optional[bool] = None


class CategoryInfo(BaseModel):
    id: int
    name: str
    type: str
    color: str
    parent_id: Optional[int] = None

    class Config:
        from_attributes = True


class BudgetCategoryResponse(BaseModel):
    id: int
    category_id: Optional[int] = None  # Optionnel pour les budgets d'épargne
    category: Optional[CategoryInfo] = None  # Optionnel pour les budgets d'épargne
    percentage: float
    is_savings: bool = False  # True si c'est un budget d'épargne
    allocated_amount: float  # Budget du mois (basé sur revenus)
    carried_over: float = 0  # Report des mois précédents (non dépensé)
    total_available: float = 0  # allocated_amount + carried_over
    spent_amount: float
    remaining_amount: float  # total_available - spent_amount
    spent_percentage: float
    period_month: Optional[int] = None
    period_year: Optional[int] = None

    class Config:
        from_attributes = True


class SavingsSummary(BaseModel):
    """Résumé de l'épargne"""
    percentage: float  # Pourcentage alloué à l'épargne
    current_month_amount: float  # Montant épargne ce mois
    total_accumulated: float  # Total cumulé depuis le début
    category_name: str
    category_color: str


class BudgetSummary(BaseModel):
    total_revenue: float
    total_expenses: float
    total_allocated: float
    total_unallocated: float
    categories: List[BudgetCategoryResponse]


def calculate_carried_over(
    db: Session,
    company_id: int,
    category_id: int,
    target_month: int,
    target_year: int
) -> float:
    """
    DEPRECATED: Utilisez calculate_carried_over_permanent à la place.
    Conservé pour compatibilité.
    """
    return 0.0


def calculate_carried_over_permanent(
    db: Session,
    company_id: int,
    category_id: int,
    percentage: float,
    target_month: int,
    target_year: int
) -> float:
    """
    Calculer le report cumulé des mois précédents pour une catégorie.
    Le report = somme de (budget alloué - dépenses) pour tous les mois précédents.

    Cette version utilise un pourcentage permanent appliqué à chaque mois.
    Inclut les dépenses des sous-catégories.
    """
    from datetime import date

    carried_over = 0.0

    # Trouver la première transaction de l'entreprise pour déterminer le début
    first_transaction = db.query(Transaction).filter(
        Transaction.company_id == company_id
    ).order_by(Transaction.transaction_date.asc()).first()

    if not first_transaction:
        return 0.0

    start_year = first_transaction.transaction_date.year
    start_month = first_transaction.transaction_date.month

    # Récupérer les IDs des sous-catégories (une seule fois)
    subcategory_ids = db.query(Category.id).filter(
        Category.parent_id == category_id
    ).all()
    subcategory_ids = [s[0] for s in subcategory_ids]
    category_ids_to_include = [category_id] + subcategory_ids

    # Parcourir tous les mois précédents
    current_year = start_year
    current_month = start_month

    while (current_year < target_year) or (current_year == target_year and current_month < target_month):
        # Revenus du mois
        month_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.company_id == company_id,
            Transaction.type == TransactionType.REVENUE,
            extract('month', Transaction.transaction_date) == current_month,
            extract('year', Transaction.transaction_date) == current_year
        ).scalar() or 0

        # Budget alloué ce mois (pourcentage permanent * revenus du mois)
        month_allocated = (percentage / 100) * month_revenue

        # Dépenses de ce mois pour cette catégorie (incluant sous-catégories)
        month_spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.company_id == company_id,
            Transaction.category_id.in_(category_ids_to_include),
            Transaction.type == TransactionType.EXPENSE,
            extract('month', Transaction.transaction_date) == current_month,
            extract('year', Transaction.transaction_date) == current_year
        ).scalar() or 0

        # Ajouter le non-dépensé au report (peut être négatif si dépassement)
        carried_over += (month_allocated - month_spent)

        # Passer au mois suivant
        current_month += 1
        if current_month > 12:
            current_month = 1
            current_year += 1

    return carried_over


@router.get("/", response_model=List[BudgetCategoryResponse])
async def get_budget_categories(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer les budgets par catégorie (permanents) avec calculs pour une période donnée"""
    company_id = current_user.current_company_id or current_user.company_id

    # Période par défaut: mois courant (utilisé uniquement pour les calculs)
    now = datetime.utcnow()
    target_month = month or now.month
    target_year = year or now.year

    # Récupérer les budgets permanents (sans filtre sur le mois)
    budget_categories = db.query(BudgetCategory).filter(
        BudgetCategory.company_id == company_id,
        BudgetCategory.is_active == True
    ).all()

    # Calculer les revenus du mois pour les montants alloués
    total_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.type == TransactionType.REVENUE,
        extract('month', Transaction.transaction_date) == target_month,
        extract('year', Transaction.transaction_date) == target_year
    ).scalar() or 0

    result = []
    for bc in budget_categories:
        # Calculer le montant alloué basé sur les revenus du mois demandé
        allocated = (bc.percentage / 100) * total_revenue

        # Pour les budgets d'épargne sans catégorie, pas de report ni de dépenses
        if bc.category_id is None:
            # Budget d'épargne global
            result.append(BudgetCategoryResponse(
                id=bc.id,
                category_id=None,
                category=None,
                percentage=bc.percentage,
                is_savings=bc.is_savings,
                allocated_amount=allocated,
                carried_over=0,
                total_available=allocated,
                spent_amount=0,
                remaining_amount=allocated,
                spent_percentage=0,
                period_month=target_month,
                period_year=target_year
            ))
            continue

        # Calculer le report des mois précédents
        carried_over = calculate_carried_over_permanent(
            db, company_id, bc.category_id, bc.percentage, target_month, target_year
        )

        # Total disponible = budget du mois + report
        total_available = allocated + carried_over

        # Calculer les dépenses de cette catégorie ce mois (incluant les sous-catégories)
        # Récupérer les IDs des sous-catégories
        subcategory_ids = db.query(Category.id).filter(
            Category.parent_id == bc.category_id
        ).all()
        subcategory_ids = [s[0] for s in subcategory_ids]

        # Inclure la catégorie elle-même et ses sous-catégories
        category_ids_to_include = [bc.category_id] + subcategory_ids

        spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.company_id == company_id,
            Transaction.category_id.in_(category_ids_to_include),
            Transaction.type == TransactionType.EXPENSE,
            extract('month', Transaction.transaction_date) == target_month,
            extract('year', Transaction.transaction_date) == target_year
        ).scalar() or 0

        remaining = total_available - spent
        spent_pct = (spent / total_available * 100) if total_available > 0 else 0

        result.append(BudgetCategoryResponse(
            id=bc.id,
            category_id=bc.category_id,
            category=CategoryInfo(
                id=bc.category.id,
                name=bc.category.name,
                type=bc.category.type.value,
                color=bc.category.color,
                parent_id=bc.category.parent_id
            ),
            percentage=bc.percentage,
            is_savings=bc.is_savings,
            allocated_amount=allocated,
            carried_over=carried_over,
            total_available=total_available,
            spent_amount=spent,
            remaining_amount=remaining,
            spent_percentage=spent_pct,
            period_month=target_month,
            period_year=target_year
        ))

    return result


@router.get("/summary", response_model=BudgetSummary)
async def get_budget_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer le résumé des budgets avec totaux"""
    company_id = current_user.current_company_id or current_user.company_id

    now = datetime.utcnow()
    target_month = month or now.month
    target_year = year or now.year

    # Revenus du mois
    total_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.type == TransactionType.REVENUE,
        extract('month', Transaction.transaction_date) == target_month,
        extract('year', Transaction.transaction_date) == target_year
    ).scalar() or 0

    # Dépenses du mois
    total_expenses = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.type == TransactionType.EXPENSE,
        extract('month', Transaction.transaction_date) == target_month,
        extract('year', Transaction.transaction_date) == target_year
    ).scalar() or 0

    # Budget categories
    categories = await get_budget_categories(target_month, target_year, current_user, db)

    total_allocated = sum(c.allocated_amount for c in categories)
    total_unallocated = total_revenue - total_allocated

    return BudgetSummary(
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        total_allocated=total_allocated,
        total_unallocated=max(0, total_unallocated),
        categories=categories
    )


@router.get("/savings/summary", response_model=SavingsSummary)
async def get_savings_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer le résumé de l'épargne cumulée.
    Calcule l'épargne en additionnant tous les mois depuis le début.
    """
    company_id = current_user.current_company_id or current_user.company_id

    # Trouver le budget marqué comme épargne
    savings_budget = db.query(BudgetCategory).filter(
        BudgetCategory.company_id == company_id,
        BudgetCategory.is_savings == True,
        BudgetCategory.is_active == True
    ).first()

    if not savings_budget:
        return SavingsSummary(
            percentage=0,
            current_month_amount=0,
            total_accumulated=0,
            category_name="",
            category_color=""
        )

    now = datetime.utcnow()
    current_month = now.month
    current_year = now.year

    # Revenus du mois courant pour calculer l'épargne de ce mois
    current_month_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.type == TransactionType.REVENUE,
        extract('month', Transaction.transaction_date) == current_month,
        extract('year', Transaction.transaction_date) == current_year
    ).scalar() or 0

    current_month_amount = (savings_budget.percentage / 100) * current_month_revenue

    # Calculer le total cumulé depuis la première transaction
    first_transaction = db.query(Transaction).filter(
        Transaction.company_id == company_id
    ).order_by(Transaction.transaction_date.asc()).first()

    total_accumulated = 0.0

    if first_transaction:
        start_year = first_transaction.transaction_date.year
        start_month = first_transaction.transaction_date.month

        # Parcourir tous les mois jusqu'à maintenant (inclus le mois courant)
        loop_year = start_year
        loop_month = start_month

        while (loop_year < current_year) or (loop_year == current_year and loop_month <= current_month):
            # Revenus du mois
            month_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
                Transaction.company_id == company_id,
                Transaction.type == TransactionType.REVENUE,
                extract('month', Transaction.transaction_date) == loop_month,
                extract('year', Transaction.transaction_date) == loop_year
            ).scalar() or 0

            # Ajouter l'épargne de ce mois
            total_accumulated += (savings_budget.percentage / 100) * month_revenue

            # Passer au mois suivant
            loop_month += 1
            if loop_month > 12:
                loop_month = 1
                loop_year += 1

    # Récupérer les infos de catégorie si disponibles
    category_name = savings_budget.category.name if savings_budget.category else "Épargne"
    category_color = savings_budget.category.color if savings_budget.category else "#10B981"

    return SavingsSummary(
        percentage=savings_budget.percentage,
        current_month_amount=current_month_amount,
        total_accumulated=total_accumulated,
        category_name=category_name,
        category_color=category_color
    )


@router.post("/", response_model=BudgetCategoryResponse)
async def create_budget_category(
    data: BudgetCategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer un budget permanent pour une catégorie"""
    company_id = current_user.current_company_id or current_user.company_id

    now = datetime.utcnow()
    current_month = now.month
    current_year = now.year

    category = None

    # Pour les budgets d'épargne, category_id est optionnel
    if data.is_savings:
        # Vérifier qu'il n'y a pas déjà un budget d'épargne
        existing = db.query(BudgetCategory).filter(
            BudgetCategory.company_id == company_id,
            BudgetCategory.is_savings == True,
            BudgetCategory.is_active == True
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Un budget d'épargne existe déjà"
            )
    else:
        # Pour les budgets normaux, category_id est requis
        if not data.category_id:
            raise HTTPException(status_code=400, detail="category_id est requis pour les budgets non-épargne")

        # Vérifier que la catégorie existe et appartient à l'entreprise
        category = db.query(Category).filter(
            Category.id == data.category_id,
            Category.company_id == company_id
        ).first()

        if not category:
            raise HTTPException(status_code=404, detail="Catégorie non trouvée")

        # Vérifier qu'il n'y a pas déjà un budget permanent pour cette catégorie
        existing = db.query(BudgetCategory).filter(
            BudgetCategory.company_id == company_id,
            BudgetCategory.category_id == data.category_id,
            BudgetCategory.is_active == True
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Un budget existe déjà pour cette catégorie"
            )

    # Vérifier que le total des pourcentages ne dépasse pas 100%
    total_pct = db.query(func.coalesce(func.sum(BudgetCategory.percentage), 0)).filter(
        BudgetCategory.company_id == company_id,
        BudgetCategory.is_active == True
    ).scalar() or 0

    if total_pct + data.percentage > 100:
        raise HTTPException(
            status_code=400,
            detail=f"Le total des pourcentages dépasserait 100% ({total_pct + data.percentage}%)"
        )

    # Créer le budget permanent (sans mois/année spécifique)
    budget_cat = BudgetCategory(
        company_id=company_id,
        category_id=data.category_id if data.category_id else None,
        percentage=data.percentage,
        is_savings=data.is_savings,
        period_month=None,
        period_year=None
    )

    db.add(budget_cat)
    db.commit()
    db.refresh(budget_cat)

    # Retourner avec les calculs pour le mois courant
    total_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.type == TransactionType.REVENUE,
        extract('month', Transaction.transaction_date) == current_month,
        extract('year', Transaction.transaction_date) == current_year
    ).scalar() or 0

    allocated = (data.percentage / 100) * total_revenue

    # Construire la réponse (category peut être None pour les budgets d'épargne)
    category_info = None
    if category:
        category_info = CategoryInfo(
            id=category.id,
            name=category.name,
            type=category.type.value,
            color=category.color,
            parent_id=category.parent_id
        )

    return BudgetCategoryResponse(
        id=budget_cat.id,
        category_id=budget_cat.category_id,
        category=category_info,
        percentage=budget_cat.percentage,
        is_savings=budget_cat.is_savings,
        allocated_amount=allocated,
        carried_over=0,
        total_available=allocated,
        spent_amount=0,
        remaining_amount=allocated,
        spent_percentage=0,
        period_month=current_month,
        period_year=current_year
    )


@router.put("/{budget_id}", response_model=BudgetCategoryResponse)
async def update_budget_category(
    budget_id: int,
    data: BudgetCategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour le pourcentage d'un budget permanent"""
    company_id = current_user.current_company_id or current_user.company_id

    now = datetime.utcnow()
    current_month = now.month
    current_year = now.year

    budget_cat = db.query(BudgetCategory).filter(
        BudgetCategory.id == budget_id,
        BudgetCategory.company_id == company_id
    ).first()

    if not budget_cat:
        raise HTTPException(status_code=404, detail="Budget non trouvé")

    # Si on met à jour le pourcentage, vérifier le total
    if data.percentage is not None:
        total_pct = db.query(func.coalesce(func.sum(BudgetCategory.percentage), 0)).filter(
            BudgetCategory.company_id == company_id,
            BudgetCategory.is_active == True,
            BudgetCategory.id != budget_id
        ).scalar() or 0

        if total_pct + data.percentage > 100:
            raise HTTPException(
                status_code=400,
                detail=f"Le total des pourcentages dépasserait 100% ({total_pct + data.percentage}%)"
            )
        budget_cat.percentage = data.percentage

    # Mettre à jour is_savings si fourni
    if data.is_savings is not None:
        budget_cat.is_savings = data.is_savings

    db.commit()
    db.refresh(budget_cat)

    # Calculer les montants pour le mois courant
    total_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.type == TransactionType.REVENUE,
        extract('month', Transaction.transaction_date) == current_month,
        extract('year', Transaction.transaction_date) == current_year
    ).scalar() or 0

    allocated = (budget_cat.percentage / 100) * total_revenue

    # Dépenses du mois courant
    spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.category_id == budget_cat.category_id,
        Transaction.type == TransactionType.EXPENSE,
        extract('month', Transaction.transaction_date) == current_month,
        extract('year', Transaction.transaction_date) == current_year
    ).scalar() or 0

    return BudgetCategoryResponse(
        id=budget_cat.id,
        category_id=budget_cat.category_id,
        category=CategoryInfo(
            id=budget_cat.category.id,
            name=budget_cat.category.name,
            type=budget_cat.category.type.value,
            color=budget_cat.category.color,
            parent_id=budget_cat.category.parent_id
        ),
        percentage=budget_cat.percentage,
        is_savings=budget_cat.is_savings,
        allocated_amount=allocated,
        spent_amount=spent,
        remaining_amount=allocated - spent,
        spent_percentage=(spent / allocated * 100) if allocated > 0 else 0,
        period_month=current_month,
        period_year=current_year
    )


@router.delete("/{budget_id}")
async def delete_budget_category(
    budget_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer un budget de catégorie"""
    company_id = current_user.current_company_id or current_user.company_id

    budget_cat = db.query(BudgetCategory).filter(
        BudgetCategory.id == budget_id,
        BudgetCategory.company_id == company_id
    ).first()

    if not budget_cat:
        raise HTTPException(status_code=404, detail="Budget non trouvé")

    db.delete(budget_cat)
    db.commit()

    return {"message": "Budget supprimé"}
