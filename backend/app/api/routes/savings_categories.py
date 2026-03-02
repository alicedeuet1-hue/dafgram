"""
Routes pour la gestion des catégories d'épargne
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.db.models import User, SavingsCategory, Transaction, TransactionType
from app.core.security import get_current_active_user

router = APIRouter(tags=["savings-categories"])


# Catégories d'épargne par défaut
DEFAULT_SAVINGS_CATEGORIES = [
    {
        "name": "Budget Croissance",
        "description": "Faire croître l'entreprise : lever des fonds, entamer des procédures pour passer à l'étape suivante, développer de nouveaux marchés.",
        "color": "#10B981",  # Vert
        "percentage": 40,
        "is_default": True
    },
    {
        "name": "Budget Investissement",
        "description": "Investir dans l'entreprise : achat de nouveau matériel, meubles, logiciels, machines, équipements informatiques.",
        "color": "#3B82F6",  # Bleu
        "percentage": 35,
        "is_default": True
    },
    {
        "name": "Budget Formation",
        "description": "Former les entrepreneurs de l'entreprise ou le personnel : formations professionnelles, certifications, coaching, conférences.",
        "color": "#8B5CF6",  # Violet
        "percentage": 25,
        "is_default": True
    }
]


# Schemas
class SavingsCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#F5C518"
    percentage: float = 0


class SavingsCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    percentage: Optional[float] = None


class SavingsCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    color: str
    percentage: float
    is_default: bool
    # Montants théoriques (basés sur revenus × pourcentage)
    allocated_amount: float = 0  # Montant total alloué depuis le début
    current_month_allocated: float = 0  # Montant alloué ce mois
    # Montants réels (transactions assignées à cette catégorie)
    spent_amount: float = 0  # Total dépensé depuis le début
    current_month_spent: float = 0  # Dépensé ce mois
    # Solde restant
    remaining_amount: float = 0  # allocated - spent
    # Anciens champs pour compatibilité (deprecated)
    accumulated_amount: float = 0
    current_month_amount: float = 0

    class Config:
        from_attributes = True


class SavingsCategorySummary(BaseModel):
    """Résumé global des catégories d'épargne"""
    total_savings_percentage: float  # Pourcentage total alloué à l'épargne (depuis budget_categories)
    total_allocated: float  # Total théoriquement alloué
    total_spent: float  # Total réellement dépensé
    total_remaining: float  # Solde restant
    current_month_allocated: float  # Alloué ce mois
    current_month_spent: float  # Dépensé ce mois
    # Anciens champs pour compatibilité
    total_accumulated: float = 0
    current_month_savings: float = 0
    categories: List[SavingsCategoryResponse]


def calculate_savings_for_category(
    db: Session,
    company_id: int,
    savings_category_id: int,
    total_savings_percentage: float,
    category_percentage: float,
    target_month: Optional[int] = None,
    target_year: Optional[int] = None
) -> dict:
    """
    Calculer l'épargne pour une catégorie d'épargne.

    Si target_month/target_year sont fournis, calcule pour ce mois spécifique.
    Sinon, utilise le mois courant.

    Retourne un dict avec:
    - allocated_amount: montant théoriquement alloué jusqu'au mois cible
    - current_month_allocated: alloué pour le mois sélectionné
    - spent_amount: montant réellement dépensé jusqu'au mois cible
    - current_month_spent: dépensé pour le mois sélectionné
    - remaining_amount: allocated - spent
    """
    from sqlalchemy import extract, and_, or_

    now = datetime.utcnow()
    selected_month = target_month if target_month else now.month
    selected_year = target_year if target_year else now.year

    # === CALCUL DES DÉPENSES RÉELLES ===
    # Total dépensé sur cette catégorie d'épargne jusqu'au mois sélectionné (inclus)
    total_spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.savings_category_id == savings_category_id,
        Transaction.type == TransactionType.EXPENSE,
        or_(
            extract('year', Transaction.transaction_date) < selected_year,
            and_(
                extract('year', Transaction.transaction_date) == selected_year,
                extract('month', Transaction.transaction_date) <= selected_month
            )
        )
    ).scalar() or 0

    # Dépensé pour le mois sélectionné uniquement
    selected_month_spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.savings_category_id == savings_category_id,
        Transaction.type == TransactionType.EXPENSE,
        extract('month', Transaction.transaction_date) == selected_month,
        extract('year', Transaction.transaction_date) == selected_year
    ).scalar() or 0

    # === CALCUL DU MONTANT THÉORIQUE ALLOUÉ ===
    first_transaction = db.query(Transaction).filter(
        Transaction.company_id == company_id
    ).order_by(Transaction.transaction_date.asc()).first()

    if not first_transaction or total_savings_percentage == 0:
        return {
            'allocated_amount': 0.0,
            'current_month_allocated': 0.0,
            'spent_amount': float(total_spent),
            'current_month_spent': float(selected_month_spent),
            'remaining_amount': -float(total_spent),
        }

    effective_percentage = (total_savings_percentage / 100) * (category_percentage / 100)

    # Revenus du mois sélectionné
    selected_month_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.company_id == company_id,
        Transaction.type == TransactionType.REVENUE,
        extract('month', Transaction.transaction_date) == selected_month,
        extract('year', Transaction.transaction_date) == selected_year
    ).scalar() or 0

    selected_month_allocated = effective_percentage * selected_month_revenue

    # Calculer le total alloué depuis le début jusqu'au mois sélectionné
    start_year = first_transaction.transaction_date.year
    start_month = first_transaction.transaction_date.month

    total_allocated = 0.0
    loop_year = start_year
    loop_month = start_month

    while (loop_year < selected_year) or (loop_year == selected_year and loop_month <= selected_month):
        month_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.company_id == company_id,
            Transaction.type == TransactionType.REVENUE,
            extract('month', Transaction.transaction_date) == loop_month,
            extract('year', Transaction.transaction_date) == loop_year
        ).scalar() or 0

        total_allocated += effective_percentage * month_revenue

        loop_month += 1
        if loop_month > 12:
            loop_month = 1
            loop_year += 1

    remaining_amount = total_allocated - float(total_spent)

    return {
        'allocated_amount': total_allocated,
        'current_month_allocated': selected_month_allocated,
        'spent_amount': float(total_spent),
        'current_month_spent': float(selected_month_spent),
        'remaining_amount': remaining_amount,
    }


@router.get("/", response_model=List[SavingsCategoryResponse])
async def get_savings_categories(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer toutes les catégories d'épargne (optionnellement pour un mois spécifique)"""
    company_id = current_user.current_company_id or current_user.company_id

    categories = db.query(SavingsCategory).filter(
        SavingsCategory.company_id == company_id,
        SavingsCategory.is_active == True
    ).all()

    # Récupérer le pourcentage total d'épargne depuis budget_categories
    from app.db.models import BudgetCategory
    savings_budget = db.query(BudgetCategory).filter(
        BudgetCategory.company_id == company_id,
        BudgetCategory.is_savings == True,
        BudgetCategory.is_active == True
    ).first()

    total_savings_percentage = savings_budget.percentage if savings_budget else 0

    result = []
    for cat in categories:
        amounts = calculate_savings_for_category(
            db, company_id, cat.id, total_savings_percentage, cat.percentage,
            target_month=month, target_year=year
        )
        result.append(SavingsCategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            color=cat.color,
            percentage=cat.percentage,
            is_default=cat.is_default,
            allocated_amount=amounts['allocated_amount'],
            current_month_allocated=amounts['current_month_allocated'],
            spent_amount=amounts['spent_amount'],
            current_month_spent=amounts['current_month_spent'],
            remaining_amount=amounts['remaining_amount'],
            # Anciens champs pour compatibilité
            accumulated_amount=amounts['allocated_amount'],
            current_month_amount=amounts['current_month_allocated'],
        ))

    return result


@router.get("/summary", response_model=SavingsCategorySummary)
async def get_savings_categories_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer le résumé des catégories d'épargne avec totaux (optionnellement pour un mois spécifique)"""
    company_id = current_user.current_company_id or current_user.company_id

    # Récupérer les catégories avec filtrage par mois
    categories = await get_savings_categories(month, year, current_user, db)

    # Récupérer le pourcentage total d'épargne
    from app.db.models import BudgetCategory
    savings_budget = db.query(BudgetCategory).filter(
        BudgetCategory.company_id == company_id,
        BudgetCategory.is_savings == True,
        BudgetCategory.is_active == True
    ).first()

    total_savings_percentage = savings_budget.percentage if savings_budget else 0

    # Calculer les totaux
    total_allocated = sum(c.allocated_amount for c in categories)
    total_spent = sum(c.spent_amount for c in categories)
    total_remaining = sum(c.remaining_amount for c in categories)
    current_month_allocated = sum(c.current_month_allocated for c in categories)
    current_month_spent = sum(c.current_month_spent for c in categories)

    return SavingsCategorySummary(
        total_savings_percentage=total_savings_percentage,
        total_allocated=total_allocated,
        total_spent=total_spent,
        total_remaining=total_remaining,
        current_month_allocated=current_month_allocated,
        current_month_spent=current_month_spent,
        # Anciens champs pour compatibilité
        total_accumulated=total_allocated,
        current_month_savings=current_month_allocated,
        categories=categories
    )


@router.post("/seed-defaults", response_model=List[SavingsCategoryResponse])
async def seed_default_categories(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer les catégories d'épargne par défaut"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier s'il y a déjà des catégories
    existing = db.query(SavingsCategory).filter(
        SavingsCategory.company_id == company_id,
        SavingsCategory.is_active == True
    ).count()

    if existing > 0:
        raise HTTPException(
            status_code=400,
            detail="Des catégories d'épargne existent déjà. Supprimez-les d'abord pour réinitialiser."
        )

    created = []
    for cat_data in DEFAULT_SAVINGS_CATEGORIES:
        cat = SavingsCategory(
            company_id=company_id,
            name=cat_data["name"],
            description=cat_data["description"],
            color=cat_data["color"],
            percentage=cat_data["percentage"],
            is_default=cat_data["is_default"]
        )
        db.add(cat)
        created.append(cat)

    db.commit()

    # Refresh pour obtenir les IDs
    for cat in created:
        db.refresh(cat)

    return [SavingsCategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        color=cat.color,
        percentage=cat.percentage,
        is_default=cat.is_default,
        accumulated_amount=0,
        current_month_amount=0
    ) for cat in created]


@router.post("/", response_model=SavingsCategoryResponse)
async def create_savings_category(
    data: SavingsCategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer une nouvelle catégorie d'épargne"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le total des pourcentages ne dépasse pas 100%
    total_pct = db.query(func.coalesce(func.sum(SavingsCategory.percentage), 0)).filter(
        SavingsCategory.company_id == company_id,
        SavingsCategory.is_active == True
    ).scalar() or 0

    if total_pct + data.percentage > 100:
        raise HTTPException(
            status_code=400,
            detail=f"Le total des pourcentages dépasserait 100% ({total_pct + data.percentage}%)"
        )

    cat = SavingsCategory(
        company_id=company_id,
        name=data.name,
        description=data.description,
        color=data.color,
        percentage=data.percentage,
        is_default=False
    )

    db.add(cat)
    db.commit()
    db.refresh(cat)

    return SavingsCategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        color=cat.color,
        percentage=cat.percentage,
        is_default=cat.is_default,
        accumulated_amount=0,
        current_month_amount=0
    )


@router.put("/{category_id}", response_model=SavingsCategoryResponse)
async def update_savings_category(
    category_id: int,
    data: SavingsCategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour une catégorie d'épargne"""
    company_id = current_user.current_company_id or current_user.company_id

    cat = db.query(SavingsCategory).filter(
        SavingsCategory.id == category_id,
        SavingsCategory.company_id == company_id
    ).first()

    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    # Vérifier le total des pourcentages si on le modifie
    if data.percentage is not None:
        total_pct = db.query(func.coalesce(func.sum(SavingsCategory.percentage), 0)).filter(
            SavingsCategory.company_id == company_id,
            SavingsCategory.is_active == True,
            SavingsCategory.id != category_id
        ).scalar() or 0

        if total_pct + data.percentage > 100:
            raise HTTPException(
                status_code=400,
                detail=f"Le total des pourcentages dépasserait 100% ({total_pct + data.percentage}%)"
            )
        cat.percentage = data.percentage

    if data.name is not None:
        cat.name = data.name
    if data.description is not None:
        cat.description = data.description
    if data.color is not None:
        cat.color = data.color

    db.commit()
    db.refresh(cat)

    # Calculer les montants
    from app.db.models import BudgetCategory
    savings_budget = db.query(BudgetCategory).filter(
        BudgetCategory.company_id == company_id,
        BudgetCategory.is_savings == True,
        BudgetCategory.is_active == True
    ).first()

    total_savings_percentage = savings_budget.percentage if savings_budget else 0
    amounts = calculate_savings_for_category(
        db, company_id, cat.id, total_savings_percentage, cat.percentage
    )

    return SavingsCategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        color=cat.color,
        percentage=cat.percentage,
        is_default=cat.is_default,
        allocated_amount=amounts['allocated_amount'],
        current_month_allocated=amounts['current_month_allocated'],
        spent_amount=amounts['spent_amount'],
        current_month_spent=amounts['current_month_spent'],
        remaining_amount=amounts['remaining_amount'],
        accumulated_amount=amounts['allocated_amount'],
        current_month_amount=amounts['current_month_allocated'],
    )


@router.delete("/{category_id}")
async def delete_savings_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer une catégorie d'épargne"""
    company_id = current_user.current_company_id or current_user.company_id

    cat = db.query(SavingsCategory).filter(
        SavingsCategory.id == category_id,
        SavingsCategory.company_id == company_id
    ).first()

    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    # Vérifier s'il y a des transactions liées
    linked_transactions = db.query(Transaction).filter(
        Transaction.savings_category_id == category_id
    ).count()

    if linked_transactions > 0:
        # Soft delete - marquer comme inactif
        cat.is_active = False
        db.commit()
        return {"message": "Catégorie désactivée (transactions liées existantes)"}

    # Hard delete si pas de transactions liées
    db.delete(cat)
    db.commit()

    return {"message": "Catégorie supprimée"}
