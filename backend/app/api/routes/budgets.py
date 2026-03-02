"""Routes pour les budgets"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.db.models import Budget, User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetStats
from app.core.security import get_current_active_user

router = APIRouter(tags=["budgets"])


def check_company_access(budget: Budget, user: User):
    """Vérifier que l'utilisateur a accès à ce budget"""
    if budget.company_id != user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this budget"
        )


@router.get("/", response_model=List[BudgetResponse])
async def get_budgets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer tous les budgets de l'entreprise"""
    budgets = db.query(Budget).filter(
        Budget.company_id == current_user.company_id,
        Budget.is_active == True
    ).offset(skip).limit(limit).all()

    # Calculer les montants restants et pourcentages
    for budget in budgets:
        budget.remaining_amount = budget.allocated_amount - budget.spent_amount
        if budget.allocated_amount > 0:
            budget.percentage_spent = (budget.spent_amount / budget.allocated_amount) * 100
        else:
            budget.percentage_spent = 0

    return budgets


@router.get("/stats", response_model=List[BudgetStats])
async def get_budget_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer les statistiques des budgets pour le camembert"""
    budgets = db.query(Budget).filter(
        Budget.company_id == current_user.company_id,
        Budget.is_active == True
    ).all()

    stats = []
    for budget in budgets:
        remaining = budget.allocated_amount - budget.spent_amount
        percentage = (budget.spent_amount / budget.allocated_amount * 100) if budget.allocated_amount > 0 else 0

        stats.append(BudgetStats(
            budget_id=budget.id,
            name=budget.name,
            allocated_amount=budget.allocated_amount,
            spent_amount=budget.spent_amount,
            remaining_amount=remaining,
            percentage_spent=percentage,
            color=budget.color
        ))

    return stats


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer un budget par ID"""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
        )

    check_company_access(budget, current_user)

    budget.remaining_amount = budget.allocated_amount - budget.spent_amount
    if budget.allocated_amount > 0:
        budget.percentage_spent = (budget.spent_amount / budget.allocated_amount) * 100
    else:
        budget.percentage_spent = 0

    return budget


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer un nouveau budget"""
    # Vérifier que l'utilisateur crée le budget pour sa propre entreprise
    if budget_data.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create budget for another company"
        )

    new_budget = Budget(**budget_data.model_dump())
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)

    new_budget.remaining_amount = new_budget.allocated_amount
    new_budget.percentage_spent = 0

    return new_budget


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: int,
    budget_data: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour un budget"""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
        )

    check_company_access(budget, current_user)

    # Mettre à jour les champs
    update_data = budget_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    db.commit()
    db.refresh(budget)

    budget.remaining_amount = budget.allocated_amount - budget.spent_amount
    if budget.allocated_amount > 0:
        budget.percentage_spent = (budget.spent_amount / budget.allocated_amount) * 100
    else:
        budget.percentage_spent = 0

    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer un budget (soft delete)"""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
        )

    check_company_access(budget, current_user)

    budget.is_active = False
    db.commit()

    return None
