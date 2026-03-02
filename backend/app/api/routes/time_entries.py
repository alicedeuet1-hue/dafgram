"""Routes pour le suivi du temps (catégories et entrées)"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import date, datetime
from calendar import monthrange
from pydantic import BaseModel
from app.db.database import get_db
from app.db.models import TimeCategory, TimeEntry, User, CompanySettings
from app.core.security import get_current_active_user

router = APIRouter(tags=["time-entries"])


def get_weeks_in_month(year: int, month: int) -> float:
    """Calcule le nombre de semaines dans un mois (avec décimales)"""
    days = monthrange(year, month)[1]
    return days / 7.0


# === SCHEMAS ===

# Time Budget Settings
class TimeBudgetSettings(BaseModel):
    weekly_budget_hours: float  # Budget hebdomadaire en heures
    weekly_budget_minutes: int  # Budget hebdomadaire en minutes


class TimeBudgetSettingsUpdate(BaseModel):
    weekly_budget_hours: Optional[float] = None  # Budget en heures (sera converti en minutes)


# Time Categories
class TimeCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#8B5CF6"
    icon: Optional[str] = None
    parent_id: Optional[int] = None  # Pour créer une sous-catégorie
    percentage: float = 0  # Pourcentage du budget hebdomadaire global


class TimeCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None
    parent_id: Optional[int] = None
    percentage: Optional[float] = None  # Pourcentage du budget hebdomadaire global


class TimeCategoryResponse(BaseModel):
    id: int
    company_id: int
    parent_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    color: str
    icon: Optional[str] = None
    position: int
    is_active: bool
    # Budget temps - pourcentage
    percentage: float = 0.0  # % du budget hebdomadaire global
    # Computed fields for summary
    total_minutes: int = 0  # Minutes consommées sur la période
    target_minutes: int = 0  # Objectif pour la période (calculé depuis %)
    remaining_minutes: int = 0  # Restant (target - total)
    # Children categories
    children: List['TimeCategoryResponse'] = []

    class Config:
        from_attributes = True


# Résoudre la référence forward pour children
TimeCategoryResponse.model_rebuild()


# Time Entries
class TimeEntryCreate(BaseModel):
    category_id: int
    date: date
    duration_minutes: int
    description: Optional[str] = None


class TimeEntryUpdate(BaseModel):
    category_id: Optional[int] = None
    date: Optional[date] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None


class CategoryInfo(BaseModel):
    id: int
    name: str
    color: str
    icon: Optional[str] = None

    class Config:
        from_attributes = True


class TimeEntryResponse(BaseModel):
    id: int
    company_id: int
    category_id: int
    category: CategoryInfo
    date: date
    duration_minutes: int
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimeSummaryByCategory(BaseModel):
    category_id: int
    category_name: str
    color: str
    icon: Optional[str] = None
    percentage: float = 0  # % du budget hebdomadaire global
    total_minutes: int  # Consommé
    target_minutes: int = 0  # Objectif pour la période
    remaining_minutes: int = 0  # Restant


class TimeSummary(BaseModel):
    total_minutes: int  # Total consommé
    total_hours: float
    total_target_minutes: int = 0  # Total objectif
    total_remaining_minutes: int = 0  # Total restant
    weekly_budget_minutes: int = 2400  # Budget hebdomadaire global (40h par défaut)
    by_category: List[TimeSummaryByCategory]
    period_month: int
    period_year: int


# === ROUTES: TIME BUDGET SETTINGS ===

def get_or_create_company_settings(db: Session, company_id: int) -> CompanySettings:
    """Helper pour récupérer ou créer les settings de l'entreprise"""
    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()
    if not settings:
        settings = CompanySettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/settings", response_model=TimeBudgetSettings)
async def get_time_budget_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer les paramètres du budget temps"""
    company_id = current_user.current_company_id or current_user.company_id
    settings = get_or_create_company_settings(db, company_id)

    return TimeBudgetSettings(
        weekly_budget_hours=settings.time_weekly_budget_minutes / 60,
        weekly_budget_minutes=settings.time_weekly_budget_minutes
    )


@router.put("/settings", response_model=TimeBudgetSettings)
async def update_time_budget_settings(
    data: TimeBudgetSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour les paramètres du budget temps"""
    company_id = current_user.current_company_id or current_user.company_id
    settings = get_or_create_company_settings(db, company_id)

    if data.weekly_budget_hours is not None:
        settings.time_weekly_budget_minutes = int(data.weekly_budget_hours * 60)

    db.commit()
    db.refresh(settings)

    return TimeBudgetSettings(
        weekly_budget_hours=settings.time_weekly_budget_minutes / 60,
        weekly_budget_minutes=settings.time_weekly_budget_minutes
    )


# === ROUTES: TIME CATEGORIES ===

@router.get("/categories", response_model=List[TimeCategoryResponse])
async def get_time_categories(
    month: Optional[int] = None,
    year: Optional[int] = None,
    flat: bool = False,  # Si True, retourne une liste plate (pour les select)
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer toutes les catégories de temps avec leurs totaux"""
    company_id = current_user.current_company_id or current_user.company_id

    # Récupérer le budget hebdomadaire global
    settings = get_or_create_company_settings(db, company_id)
    weekly_budget = settings.time_weekly_budget_minutes

    categories = db.query(TimeCategory).filter(
        TimeCategory.company_id == company_id,
        TimeCategory.is_active == True
    ).order_by(TimeCategory.position).all()

    # Calculer les totaux si mois/année spécifiés
    totals_dict = {}
    weeks_in_month = 4.0  # Par défaut
    if month and year:
        weeks_in_month = get_weeks_in_month(year, month)
        totals = db.query(
            TimeEntry.category_id,
            func.sum(TimeEntry.duration_minutes).label('total_minutes')
        ).filter(
            TimeEntry.company_id == company_id,
            extract('month', TimeEntry.date) == month,
            extract('year', TimeEntry.date) == year
        ).group_by(TimeEntry.category_id).all()

        totals_dict = {t.category_id: t.total_minutes for t in totals}

    # Helper pour construire la réponse d'une catégorie
    def build_category_response(cat, children_list=None):
        cat_total = totals_dict.get(cat.id, 0) or 0
        # Ajouter les totaux des enfants
        children_total = 0
        children_percentage = 0
        if children_list:
            for child in children_list:
                children_total += child.total_minutes
                children_percentage += child.percentage
            cat_total += children_total

        # Calculer l'objectif basé sur le pourcentage du budget hebdomadaire global
        cat_percentage = (cat.percentage or 0) + children_percentage
        cat_target = int((cat_percentage / 100) * weekly_budget * weeks_in_month)

        cat_remaining = cat_target - cat_total

        return TimeCategoryResponse(
            id=cat.id,
            company_id=cat.company_id,
            parent_id=cat.parent_id,
            name=cat.name,
            description=cat.description,
            color=cat.color,
            icon=cat.icon,
            position=cat.position,
            is_active=cat.is_active,
            percentage=round(cat_percentage, 1),
            total_minutes=cat_total,
            target_minutes=cat_target,
            remaining_minutes=cat_remaining,
            children=children_list or []
        )

    # Si flat=True, retourner une liste plate
    if flat:
        return [build_category_response(cat) for cat in categories]

    # Sinon, construire l'arborescence
    # Séparer parents et enfants
    parents = [c for c in categories if c.parent_id is None]
    children_by_parent = {}
    for cat in categories:
        if cat.parent_id:
            if cat.parent_id not in children_by_parent:
                children_by_parent[cat.parent_id] = []
            children_by_parent[cat.parent_id].append(cat)

    # Construire la réponse hiérarchique
    result = []
    for parent in parents:
        children_cats = children_by_parent.get(parent.id, [])
        children_responses = [build_category_response(c) for c in children_cats]
        result.append(build_category_response(parent, children_responses))

    return result


@router.post("/categories/seed-defaults", response_model=List[TimeCategoryResponse])
async def seed_default_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer les catégories par défaut (Travail, Formation, Repos)"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier si des catégories existent déjà
    existing = db.query(TimeCategory).filter(
        TimeCategory.company_id == company_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Des catégories existent déjà")

    defaults = [
        {"name": "Travail", "color": "#8B5CF6", "icon": "Work", "position": 0,
         "description": "Temps de travail productif", "percentage": 70},
        {"name": "Formation", "color": "#3B82F6", "icon": "School", "position": 1,
         "description": "Apprentissage et développement de compétences", "percentage": 20},
        {"name": "Repos", "color": "#10B981", "icon": "Weekend", "position": 2,
         "description": "Pauses et temps de récupération", "percentage": 10},
    ]

    created = []
    for cat_data in defaults:
        cat = TimeCategory(company_id=company_id, **cat_data)
        db.add(cat)
        created.append(cat)

    db.commit()
    for cat in created:
        db.refresh(cat)

    return created


@router.post("/categories", response_model=TimeCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_time_category(
    data: TimeCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer une nouvelle catégorie de temps (ou sous-catégorie si parent_id est spécifié)"""
    company_id = current_user.current_company_id or current_user.company_id

    # Si parent_id est spécifié, vérifier qu'il existe et appartient à la même entreprise
    if data.parent_id:
        parent = db.query(TimeCategory).filter(
            TimeCategory.id == data.parent_id,
            TimeCategory.company_id == company_id,
            TimeCategory.is_active == True
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Catégorie parente non trouvée")

    # Trouver la position max (parmi les catégories du même niveau)
    position_query = db.query(func.max(TimeCategory.position)).filter(
        TimeCategory.company_id == company_id
    )
    if data.parent_id:
        position_query = position_query.filter(TimeCategory.parent_id == data.parent_id)
    else:
        position_query = position_query.filter(TimeCategory.parent_id.is_(None))

    max_position = position_query.scalar() or -1

    category = TimeCategory(
        company_id=company_id,
        parent_id=data.parent_id,
        name=data.name,
        description=data.description,
        color=data.color,
        icon=data.icon,
        percentage=data.percentage,
        position=max_position + 1
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


@router.put("/categories/{category_id}", response_model=TimeCategoryResponse)
async def update_time_category(
    category_id: int,
    data: TimeCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour une catégorie de temps"""
    company_id = current_user.current_company_id or current_user.company_id

    category = db.query(TimeCategory).filter(
        TimeCategory.id == category_id,
        TimeCategory.company_id == company_id
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer une catégorie de temps (soft delete)"""
    company_id = current_user.current_company_id or current_user.company_id

    category = db.query(TimeCategory).filter(
        TimeCategory.id == category_id,
        TimeCategory.company_id == company_id
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    # Vérifier s'il y a des entrées liées
    entries_count = db.query(TimeEntry).filter(
        TimeEntry.category_id == category_id
    ).count()

    if entries_count > 0:
        # Soft delete
        category.is_active = False
        db.commit()
    else:
        # Hard delete si pas d'entrées
        db.delete(category)
        db.commit()

    return None


# === ROUTES: TIME ENTRIES ===

@router.get("/", response_model=List[TimeEntryResponse])
async def get_time_entries(
    month: Optional[int] = None,
    year: Optional[int] = None,
    category_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer les entrées de temps avec filtres"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(TimeEntry).filter(TimeEntry.company_id == company_id)

    # Filtrer par mois/année
    if month and year:
        query = query.filter(
            extract('month', TimeEntry.date) == month,
            extract('year', TimeEntry.date) == year
        )
    elif start_date and end_date:
        query = query.filter(
            TimeEntry.date >= start_date,
            TimeEntry.date <= end_date
        )

    # Filtrer par catégorie
    if category_id:
        query = query.filter(TimeEntry.category_id == category_id)

    entries = query.order_by(TimeEntry.date.desc()).offset(skip).limit(limit).all()

    return entries


@router.get("/summary", response_model=TimeSummary)
async def get_time_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer le résumé du temps par catégorie pour un mois"""
    company_id = current_user.current_company_id or current_user.company_id

    # Récupérer le budget hebdomadaire global
    settings = get_or_create_company_settings(db, company_id)
    weekly_budget = settings.time_weekly_budget_minutes

    # Nombre de semaines dans le mois
    weeks_in_month = get_weeks_in_month(year, month)

    # Récupérer toutes les catégories actives (seulement les parents pour le résumé)
    categories = db.query(TimeCategory).filter(
        TimeCategory.company_id == company_id,
        TimeCategory.is_active == True,
        TimeCategory.parent_id.is_(None)  # Seulement les catégories parentes
    ).order_by(TimeCategory.position).all()

    # Récupérer aussi les sous-catégories pour calculer les totaux
    all_categories = db.query(TimeCategory).filter(
        TimeCategory.company_id == company_id,
        TimeCategory.is_active == True
    ).all()
    children_by_parent = {}
    for cat in all_categories:
        if cat.parent_id:
            if cat.parent_id not in children_by_parent:
                children_by_parent[cat.parent_id] = []
            children_by_parent[cat.parent_id].append(cat)

    # Calculer le temps total par catégorie pour le mois
    entries = db.query(
        TimeEntry.category_id,
        func.sum(TimeEntry.duration_minutes).label('total_minutes')
    ).filter(
        TimeEntry.company_id == company_id,
        extract('month', TimeEntry.date) == month,
        extract('year', TimeEntry.date) == year
    ).group_by(TimeEntry.category_id).all()

    # Créer un dict pour accès rapide
    time_by_category = {e.category_id: e.total_minutes or 0 for e in entries}

    # Construire la liste par catégorie
    by_category = []
    total_consumed = 0
    total_target = 0
    total_remaining = 0

    for cat in categories:
        # Minutes consommées (catégorie + enfants)
        minutes = time_by_category.get(cat.id, 0)
        for child in children_by_parent.get(cat.id, []):
            minutes += time_by_category.get(child.id, 0)

        # Calculer le pourcentage total (catégorie + enfants)
        cat_percentage = cat.percentage or 0
        for child in children_by_parent.get(cat.id, []):
            cat_percentage += child.percentage or 0

        # Objectif pour le mois basé sur le pourcentage du budget hebdomadaire
        cat_target = int((cat_percentage / 100) * weekly_budget * weeks_in_month)

        remaining = cat_target - minutes

        total_consumed += minutes
        total_target += cat_target
        total_remaining += remaining

        by_category.append(TimeSummaryByCategory(
            category_id=cat.id,
            category_name=cat.name,
            color=cat.color,
            icon=cat.icon,
            percentage=round(cat_percentage, 1),
            total_minutes=minutes,
            target_minutes=cat_target,
            remaining_minutes=remaining
        ))

    return TimeSummary(
        total_minutes=total_consumed,
        total_hours=round(total_consumed / 60, 1),
        total_target_minutes=total_target,
        total_remaining_minutes=total_remaining,
        weekly_budget_minutes=weekly_budget,
        by_category=by_category,
        period_month=month,
        period_year=year
    )


@router.get("/{entry_id}", response_model=TimeEntryResponse)
async def get_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer une entrée de temps par ID"""
    company_id = current_user.current_company_id or current_user.company_id

    entry = db.query(TimeEntry).filter(
        TimeEntry.id == entry_id,
        TimeEntry.company_id == company_id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entrée de temps non trouvée")

    return entry


@router.post("/", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_time_entry(
    data: TimeEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer une nouvelle entrée de temps"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que la catégorie existe et appartient à l'entreprise
    category = db.query(TimeCategory).filter(
        TimeCategory.id == data.category_id,
        TimeCategory.company_id == company_id,
        TimeCategory.is_active == True
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    entry = TimeEntry(
        company_id=company_id,
        category_id=data.category_id,
        date=data.date,
        duration_minutes=data.duration_minutes,
        description=data.description
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry


@router.put("/{entry_id}", response_model=TimeEntryResponse)
async def update_time_entry(
    entry_id: int,
    data: TimeEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour une entrée de temps"""
    company_id = current_user.current_company_id or current_user.company_id

    entry = db.query(TimeEntry).filter(
        TimeEntry.id == entry_id,
        TimeEntry.company_id == company_id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entrée de temps non trouvée")

    # Si on change de catégorie, vérifier qu'elle existe
    if data.category_id and data.category_id != entry.category_id:
        category = db.query(TimeCategory).filter(
            TimeCategory.id == data.category_id,
            TimeCategory.company_id == company_id,
            TimeCategory.is_active == True
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)

    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer une entrée de temps"""
    company_id = current_user.current_company_id or current_user.company_id

    entry = db.query(TimeEntry).filter(
        TimeEntry.id == entry_id,
        TimeEntry.company_id == company_id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entrée de temps non trouvée")

    db.delete(entry)
    db.commit()

    return None
