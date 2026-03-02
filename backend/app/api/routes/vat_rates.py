"""Routes pour la gestion des taux de TVA"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import User, VatRate
from app.core.security import get_current_active_user

router = APIRouter(tags=["vat_rates"])


# ============== Schemas ==============

class VatRateCreate(BaseModel):
    name: str
    rate: float
    description: Optional[str] = None
    is_default: bool = False
    position: int = 0


class VatRateUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[float] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    position: Optional[int] = None


class VatRateResponse(BaseModel):
    id: int
    name: str
    rate: float
    description: Optional[str]
    is_default: bool
    is_active: bool
    position: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== Routes ==============

@router.get("/", response_model=List[VatRateResponse])
async def get_vat_rates(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer tous les taux de TVA de l'entreprise"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(VatRate).filter(VatRate.company_id == company_id)

    if not include_inactive:
        query = query.filter(VatRate.is_active == True)

    return query.order_by(VatRate.position, VatRate.rate).all()


@router.post("/", response_model=VatRateResponse, status_code=status.HTTP_201_CREATED)
async def create_vat_rate(
    data: VatRateCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer un nouveau taux de TVA"""
    company_id = current_user.current_company_id or current_user.company_id

    # Si ce taux est défini comme par défaut, désactiver les autres
    if data.is_default:
        db.query(VatRate).filter(
            VatRate.company_id == company_id,
            VatRate.is_default == True
        ).update({"is_default": False})

    vat_rate = VatRate(
        company_id=company_id,
        **data.model_dump()
    )

    db.add(vat_rate)
    db.commit()
    db.refresh(vat_rate)

    return vat_rate


@router.put("/{vat_rate_id}", response_model=VatRateResponse)
async def update_vat_rate(
    vat_rate_id: int,
    data: VatRateUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour un taux de TVA"""
    company_id = current_user.current_company_id or current_user.company_id

    vat_rate = db.query(VatRate).filter(
        VatRate.id == vat_rate_id,
        VatRate.company_id == company_id
    ).first()

    if not vat_rate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Taux de TVA non trouvé"
        )

    update_data = data.model_dump(exclude_unset=True)

    # Si ce taux est défini comme par défaut, désactiver les autres
    if update_data.get('is_default'):
        db.query(VatRate).filter(
            VatRate.company_id == company_id,
            VatRate.id != vat_rate_id,
            VatRate.is_default == True
        ).update({"is_default": False})

    for field, value in update_data.items():
        setattr(vat_rate, field, value)

    db.commit()
    db.refresh(vat_rate)

    return vat_rate


@router.delete("/{vat_rate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vat_rate(
    vat_rate_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer un taux de TVA"""
    company_id = current_user.current_company_id or current_user.company_id

    vat_rate = db.query(VatRate).filter(
        VatRate.id == vat_rate_id,
        VatRate.company_id == company_id
    ).first()

    if not vat_rate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Taux de TVA non trouvé"
        )

    db.delete(vat_rate)
    db.commit()

    return None


@router.post("/seed-defaults", response_model=List[VatRateResponse])
async def seed_default_vat_rates(
    country: str = "FR",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer les taux de TVA par défaut selon le pays"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier s'il existe déjà des taux
    existing = db.query(VatRate).filter(VatRate.company_id == company_id).count()
    if existing > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Des taux de TVA existent déjà pour cette entreprise"
        )

    # Taux par défaut selon le pays
    default_rates = {
        "FR": [
            {"name": "TVA normale", "rate": 20.0, "description": "Taux standard France", "is_default": True, "position": 0},
            {"name": "TVA intermédiaire", "rate": 10.0, "description": "Restauration, travaux, etc.", "position": 1},
            {"name": "TVA réduite", "rate": 5.5, "description": "Alimentation, livres, etc.", "position": 2},
            {"name": "TVA super-réduite", "rate": 2.1, "description": "Médicaments remboursés, presse", "position": 3},
            {"name": "Exonéré", "rate": 0, "description": "Exportations, formations, etc.", "position": 4},
        ],
        "BE": [
            {"name": "TVA normale", "rate": 21.0, "description": "Taux standard Belgique", "is_default": True, "position": 0},
            {"name": "TVA réduite", "rate": 12.0, "description": "Logement social, etc.", "position": 1},
            {"name": "TVA super-réduite", "rate": 6.0, "description": "Alimentation, livres, etc.", "position": 2},
            {"name": "Exonéré", "rate": 0, "description": "Exportations, etc.", "position": 3},
        ],
        "CH": [
            {"name": "TVA normale", "rate": 8.1, "description": "Taux standard Suisse", "is_default": True, "position": 0},
            {"name": "TVA hébergement", "rate": 3.8, "description": "Hébergement touristique", "position": 1},
            {"name": "TVA réduite", "rate": 2.6, "description": "Alimentation, médicaments, etc.", "position": 2},
            {"name": "Exonéré", "rate": 0, "description": "Exportations, santé, etc.", "position": 3},
        ],
        "DE": [
            {"name": "TVA normale", "rate": 19.0, "description": "Taux standard Allemagne", "is_default": True, "position": 0},
            {"name": "TVA réduite", "rate": 7.0, "description": "Alimentation, livres, etc.", "position": 1},
            {"name": "Exonéré", "rate": 0, "description": "Exportations, etc.", "position": 2},
        ],
        "ES": [
            {"name": "IVA general", "rate": 21.0, "description": "Taux standard Espagne", "is_default": True, "position": 0},
            {"name": "IVA reducido", "rate": 10.0, "description": "Alimentation, etc.", "position": 1},
            {"name": "IVA superreducido", "rate": 4.0, "description": "Produits de première nécessité", "position": 2},
            {"name": "Exento", "rate": 0, "description": "Exportations, etc.", "position": 3},
        ],
        "IT": [
            {"name": "IVA ordinaria", "rate": 22.0, "description": "Taux standard Italie", "is_default": True, "position": 0},
            {"name": "IVA ridotta", "rate": 10.0, "description": "Services touristiques, etc.", "position": 1},
            {"name": "IVA super-ridotta", "rate": 5.0, "description": "Alimentation spéciale", "position": 2},
            {"name": "IVA minima", "rate": 4.0, "description": "Produits de première nécessité", "position": 3},
            {"name": "Esente", "rate": 0, "description": "Exportations, etc.", "position": 4},
        ],
        "LU": [
            {"name": "TVA normale", "rate": 17.0, "description": "Taux standard Luxembourg", "is_default": True, "position": 0},
            {"name": "TVA intermédiaire", "rate": 14.0, "description": "Vins, etc.", "position": 1},
            {"name": "TVA réduite", "rate": 8.0, "description": "Gaz, électricité, etc.", "position": 2},
            {"name": "TVA super-réduite", "rate": 3.0, "description": "Alimentation, livres, etc.", "position": 3},
            {"name": "Exonéré", "rate": 0, "description": "Exportations, etc.", "position": 4},
        ],
        "MA": [
            {"name": "TVA normale", "rate": 20.0, "description": "Taux standard Maroc", "is_default": True, "position": 0},
            {"name": "TVA réduite", "rate": 14.0, "description": "Transport, etc.", "position": 1},
            {"name": "TVA réduite", "rate": 10.0, "description": "Hôtellerie, etc.", "position": 2},
            {"name": "TVA super-réduite", "rate": 7.0, "description": "Eau, électricité, etc.", "position": 3},
            {"name": "Exonéré", "rate": 0, "description": "Exportations, produits de base", "position": 4},
        ],
        "NC": [  # Nouvelle-Calédonie (XPF)
            {"name": "TGC générale", "rate": 11.0, "description": "Taux standard Nouvelle-Calédonie", "is_default": True, "position": 0},
            {"name": "TGC réduite", "rate": 6.0, "description": "Alimentation, etc.", "position": 1},
            {"name": "TGC spéciale", "rate": 3.0, "description": "Produits de première nécessité", "position": 2},
            {"name": "Exonéré", "rate": 0, "description": "Exportations, etc.", "position": 3},
        ],
    }

    rates_to_create = default_rates.get(country.upper(), default_rates["FR"])
    created_rates = []

    for rate_data in rates_to_create:
        vat_rate = VatRate(company_id=company_id, **rate_data)
        db.add(vat_rate)
        created_rates.append(vat_rate)

    db.commit()

    for rate in created_rates:
        db.refresh(rate)

    return created_rates
