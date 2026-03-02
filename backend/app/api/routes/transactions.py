"""Routes pour les transactions (dépenses et revenus)"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db
from app.db.models import Transaction, Budget, User, TransactionType, Category, BankAccountType
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionStats
)
from app.core.security import get_current_active_user

router = APIRouter(tags=["transactions"])


def check_company_access(transaction: Transaction, user: User):
    """Vérifier que l'utilisateur a accès à cette transaction"""
    if transaction.company_id != user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this transaction"
        )


class PaginatedTransactionsResponse:
    """Réponse paginée pour les transactions"""
    pass


@router.get("/")
async def get_transactions(
    skip: int = 0,
    limit: int = 100,
    page: Optional[int] = None,
    type: Optional[TransactionType] = None,
    budget_id: Optional[int] = None,
    category_id: Optional[int] = None,
    savings_category_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    account_type: Optional[BankAccountType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer toutes les transactions avec filtres optionnels et pagination"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(Transaction).filter(
        Transaction.company_id == company_id
    )

    # Filtre par type de compte (entreprise ou associé)
    if account_type:
        query = query.filter(Transaction.account_type == account_type)

    if type:
        query = query.filter(Transaction.type == type)
    if budget_id:
        query = query.filter(Transaction.budget_id == budget_id)
    if category_id:
        # Vérifier si c'est une catégorie parente (avec sous-catégories)
        category = db.query(Category).filter(Category.id == category_id).first()
        if category:
            # Récupérer les IDs des sous-catégories
            subcategory_ids = db.query(Category.id).filter(
                Category.parent_id == category_id
            ).all()
            subcategory_ids = [s[0] for s in subcategory_ids]

            if subcategory_ids:
                # Inclure la catégorie parente ET ses sous-catégories
                from sqlalchemy import or_
                query = query.filter(
                    or_(
                        Transaction.category_id == category_id,
                        Transaction.category_id.in_(subcategory_ids)
                    )
                )
            else:
                # Pas de sous-catégories, filtrer normalement
                query = query.filter(Transaction.category_id == category_id)
        else:
            query = query.filter(Transaction.category_id == category_id)
    if savings_category_id:
        query = query.filter(Transaction.savings_category_id == savings_category_id)
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)

    # Compter le total
    total = query.count()

    # Support pour la pagination par page
    if page is not None:
        skip = (page - 1) * limit

    transactions = query.order_by(Transaction.transaction_date.desc()).offset(skip).limit(limit).all()

    return {
        "items": transactions,
        "total": total,
        "page": page or (skip // limit) + 1,
        "pages": (total + limit - 1) // limit,
        "limit": limit
    }


@router.get("/stats/comparison")
async def get_transaction_stats_comparison(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer les statistiques d'un mois avec comparaison au mois précédent"""
    from datetime import date
    from calendar import monthrange

    company_id = current_user.current_company_id or current_user.company_id

    # Utiliser le mois/année fourni ou le mois en cours par défaut
    today = date.today()
    target_year = year if year is not None else today.year
    target_month = month if month is not None else today.month

    # Dates du mois cible
    current_month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        current_month_end = datetime(target_year + 1, 1, 1)
    else:
        current_month_end = datetime(target_year, target_month + 1, 1)

    # Dates du mois précédent
    if target_month == 1:
        prev_month_start = datetime(target_year - 1, 12, 1)
        prev_month_end = datetime(target_year, 1, 1)
    else:
        prev_month_start = datetime(target_year, target_month - 1, 1)
        prev_month_end = current_month_start

    def get_month_stats(start: datetime, end: datetime):
        query = db.query(Transaction).filter(
            Transaction.company_id == company_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end
        )

        revenue = query.filter(Transaction.type == TransactionType.REVENUE).with_entities(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).scalar() or 0

        expenses = query.filter(Transaction.type == TransactionType.EXPENSE).with_entities(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).scalar() or 0

        return {"revenue": float(revenue), "expenses": float(expenses)}

    current_stats = get_month_stats(current_month_start, current_month_end)
    prev_stats = get_month_stats(prev_month_start, prev_month_end)

    # Calcul des pourcentages de variation
    def calc_change(current: float, previous: float) -> float:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)

    return {
        "current_month": {
            "revenue": current_stats["revenue"],
            "expenses": current_stats["expenses"],
            "net_profit": current_stats["revenue"] - current_stats["expenses"],
        },
        "previous_month": {
            "revenue": prev_stats["revenue"],
            "expenses": prev_stats["expenses"],
            "net_profit": prev_stats["revenue"] - prev_stats["expenses"],
        },
        "changes": {
            "revenue": calc_change(current_stats["revenue"], prev_stats["revenue"]),
            "expenses": calc_change(current_stats["expenses"], prev_stats["expenses"]),
            "net_profit": calc_change(
                current_stats["revenue"] - current_stats["expenses"],
                prev_stats["revenue"] - prev_stats["expenses"]
            ),
        },
        "month": target_month,
        "year": target_year
    }


@router.get("/stats/history")
async def get_transaction_stats_history(
    period: str = Query("month", regex="^(day|week|month)$"),
    count: int = Query(6, ge=1, le=12),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer l'historique des revenus/dépenses par période (jour, semaine, mois)

    offset permet de naviguer dans le passé:
    - offset=0: périodes les plus récentes
    - offset=1: 6 périodes plus anciennes, etc.
    """
    from datetime import date, timedelta
    from calendar import monthrange

    company_id = current_user.current_company_id or current_user.company_id
    today = date.today()
    result = []

    # Calculer le décalage en fonction de l'offset
    total_offset = offset * count

    def get_period_stats(start: datetime, end: datetime):
        query = db.query(Transaction).filter(
            Transaction.company_id == company_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end
        )

        revenue = query.filter(Transaction.type == TransactionType.REVENUE).with_entities(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).scalar() or 0

        expenses = query.filter(Transaction.type == TransactionType.EXPENSE).with_entities(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).scalar() or 0

        return {"revenue": float(revenue), "expenses": float(expenses)}

    if period == "day":
        for i in range(count - 1, -1, -1):
            day = today - timedelta(days=i + total_offset)
            start = datetime(day.year, day.month, day.day)
            end = start + timedelta(days=1)
            stats = get_period_stats(start, end)
            result.append({
                "label": day.strftime("%d/%m"),
                "revenue": stats["revenue"],
                "expenses": stats["expenses"],
                "date": day.isoformat()
            })

    elif period == "week":
        for i in range(count - 1, -1, -1):
            week_end = today - timedelta(days=(i + total_offset) * 7)
            week_start = week_end - timedelta(days=6)
            start = datetime(week_start.year, week_start.month, week_start.day)
            end = datetime(week_end.year, week_end.month, week_end.day) + timedelta(days=1)
            stats = get_period_stats(start, end)
            result.append({
                "label": f"S{week_end.isocalendar()[1]}",
                "revenue": stats["revenue"],
                "expenses": stats["expenses"],
                "start_date": week_start.isoformat(),
                "end_date": week_end.isoformat()
            })

    else:  # month
        for i in range(count - 1, -1, -1):
            # Calculer le mois cible avec offset
            target_month = today.month - i - total_offset
            target_year = today.year
            while target_month <= 0:
                target_month += 12
                target_year -= 1

            start = datetime(target_year, target_month, 1)
            if target_month == 12:
                end = datetime(target_year + 1, 1, 1)
            else:
                end = datetime(target_year, target_month + 1, 1)

            stats = get_period_stats(start, end)
            month_names = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin",
                          "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]
            result.append({
                "label": month_names[target_month - 1],
                "revenue": stats["revenue"],
                "expenses": stats["expenses"],
                "month": target_month,
                "year": target_year
            })

    return {"data": result, "period": period, "offset": offset}


@router.get("/stats", response_model=TransactionStats)
async def get_transaction_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    account_type: Optional[BankAccountType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer les statistiques des transactions"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(Transaction).filter(
        Transaction.company_id == company_id
    )

    # Filtre par type de compte (entreprise ou associé)
    if account_type:
        query = query.filter(Transaction.account_type == account_type)

    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)

    # Calculer les totaux
    revenue_total = query.filter(Transaction.type == TransactionType.REVENUE).with_entities(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).scalar()

    expense_total = query.filter(Transaction.type == TransactionType.EXPENSE).with_entities(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).scalar()

    transaction_count = query.count()

    return TransactionStats(
        total_revenue=revenue_total or 0,
        total_expenses=expense_total or 0,
        net_balance=(revenue_total or 0) - (expense_total or 0),
        transaction_count=transaction_count
    )


@router.get("/stats/associate-summary")
async def get_associate_account_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer le résumé du compte associé - total des dépenses à rembourser"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(Transaction).filter(
        Transaction.company_id == company_id,
        Transaction.account_type == BankAccountType.ASSOCIATE
    )

    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)

    # Dépenses = ce que l'entreprise doit aux associés
    total_expenses = query.filter(Transaction.type == TransactionType.EXPENSE).with_entities(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).scalar() or 0

    # "Revenus" dans le compte associé = remboursements effectués
    total_reimbursed = query.filter(Transaction.type == TransactionType.REVENUE).with_entities(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).scalar() or 0

    transaction_count = query.count()

    return {
        "total_expenses": float(total_expenses),
        "total_reimbursed": float(total_reimbursed),
        "balance_to_reimburse": float(total_expenses - total_reimbursed),
        "transaction_count": transaction_count
    }


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer une transaction par ID"""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    check_company_access(transaction, current_user)
    return transaction


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer une nouvelle transaction"""
    # Vérifier que l'utilisateur crée la transaction pour sa propre entreprise
    if transaction_data.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create transaction for another company"
        )

    # Si un budget est associé, vérifier qu'il appartient à la même entreprise
    if transaction_data.budget_id:
        budget = db.query(Budget).filter(Budget.id == transaction_data.budget_id).first()
        if not budget or budget.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Budget not found or not accessible"
            )

    new_transaction = Transaction(**transaction_data.model_dump())
    if not new_transaction.transaction_date:
        new_transaction.transaction_date = datetime.utcnow()

    db.add(new_transaction)

    # Mettre à jour le montant dépensé du budget si c'est une dépense
    if transaction_data.type == TransactionType.EXPENSE and transaction_data.budget_id:
        budget = db.query(Budget).filter(Budget.id == transaction_data.budget_id).first()
        if budget:
            budget.spent_amount += transaction_data.amount

    db.commit()
    db.refresh(new_transaction)

    return new_transaction


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour une transaction"""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    check_company_access(transaction, current_user)

    # Sauvegarder l'ancien montant pour ajuster le budget
    old_amount = transaction.amount
    old_budget_id = transaction.budget_id

    # Mettre à jour les champs
    update_data = transaction_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)

    # Ajuster les budgets si nécessaire
    if transaction.type == TransactionType.EXPENSE:
        # Retirer l'ancien montant de l'ancien budget
        if old_budget_id:
            old_budget = db.query(Budget).filter(Budget.id == old_budget_id).first()
            if old_budget:
                old_budget.spent_amount -= old_amount

        # Ajouter le nouveau montant au nouveau budget
        if transaction.budget_id:
            new_budget = db.query(Budget).filter(Budget.id == transaction.budget_id).first()
            if new_budget:
                new_budget.spent_amount += transaction.amount

    db.commit()
    db.refresh(transaction)

    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer une transaction"""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    check_company_access(transaction, current_user)

    # Ajuster le budget si c'est une dépense
    if transaction.type == TransactionType.EXPENSE and transaction.budget_id:
        budget = db.query(Budget).filter(Budget.id == transaction.budget_id).first()
        if budget:
            budget.spent_amount -= transaction.amount

    db.delete(transaction)
    db.commit()

    return None
