"""
Routes pour la gestion des entreprises utilisateur
"""
import os
import uuid
import shutil
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.database import get_db
from app.db.models import (
    User, Company, UserCompany, UserCompanyRole, CompanySettings, BankAccount,
    AccountType, SubscriptionPlan, UserRole,
    Budget, Transaction, Employee, SalesGoal, TimeCategory, TimeEntry,
    Document, Category, CategoryRule, BudgetCategory, BankImport,
    Client, ClientAttachment, SavingsCategory, VatRate,
    Invoice, InvoiceLineItem, InvoicePayment,
    Quote, QuoteLineItem,
    PaymentRetry, SubscriptionHistory, PaymentTransaction,
)
from app.core.security import get_current_active_user
from app.core.config import settings
from app.schemas.company import (
    CompanySettingsResponse,
    CompanySettingsUpdate,
    BankAccountCreate,
    BankAccountUpdate,
    BankAccountResponse,
)

router = APIRouter(tags=["companies"])

# Dossier pour stocker les uploads
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Schemas
class CompanyResponse(BaseModel):
    id: int
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    vat_number: Optional[str] = None
    currency: Optional[str] = "EUR"
    language: Optional[str] = "fr"
    logo_url: Optional[str] = None
    account_type: Optional[str] = None
    is_active: bool
    name_changed: bool = False

    class Config:
        from_attributes = True


class UserCompanyResponse(BaseModel):
    id: int
    company: CompanyResponse
    role: UserCompanyRole
    is_default: bool

    class Config:
        from_attributes = True


class CompanyUpdateRequest(BaseModel):
    """Mise à jour des informations de l'entreprise"""
    name: Optional[str] = None  # Peut être modifié une seule fois
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    language: Optional[str] = None
    account_type: Optional[str] = None  # 'personal' ou 'business'


class SwitchCompanyRequest(BaseModel):
    company_id: int


@router.get("/me/companies", response_model=List[UserCompanyResponse])
async def get_my_companies(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer toutes les entreprises de l'utilisateur connecté"""
    user_companies = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id
    ).all()

    # Si l'utilisateur n'a pas encore d'entrées dans user_companies,
    # créer une entrée pour son entreprise principale
    if not user_companies:
        default_uc = UserCompany(
            user_id=current_user.id,
            company_id=current_user.company_id,
            role=UserCompanyRole.OWNER,
            is_default=True
        )
        db.add(default_uc)
        db.commit()
        db.refresh(default_uc)
        user_companies = [default_uc]

    return user_companies


@router.get("/me/current-company", response_model=CompanyResponse)
async def get_current_company(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer l'entreprise actuellement sélectionnée"""
    company_id = current_user.current_company_id or current_user.company_id
    company = db.query(Company).filter(Company.id == company_id).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entreprise non trouvée"
        )

    return company


@router.post("/me/switch-company")
async def switch_company(
    request: SwitchCompanyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Changer l'entreprise active de l'utilisateur"""
    # Vérifier que l'utilisateur a accès à cette entreprise
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == request.company_id
    ).first()

    if not user_company:
        # Vérifier si c'est son entreprise principale (legacy)
        if current_user.company_id != request.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous n'avez pas accès à cette entreprise"
            )

    # Mettre à jour l'entreprise courante
    current_user.current_company_id = request.company_id
    db.commit()

    return {"message": "Entreprise changée avec succès", "company_id": request.company_id}


@router.put("/me/company", response_model=CompanyResponse)
async def update_current_company(
    data: CompanyUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour les informations de l'entreprise courante.
    Seuls les champs non-légaux peuvent être modifiés.
    """
    # Debug: log the raw Pydantic model
    print(f"DEBUG: Raw data received: {data}")
    print(f"DEBUG: data.currency = {data.currency}")
    print(f"DEBUG: data.language = {data.language}")

    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que l'utilisateur a les droits d'admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour modifier cette entreprise"
        )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entreprise non trouvée"
        )

    # Mettre à jour uniquement les champs autorisés
    update_data = data.model_dump(exclude_unset=True)
    print(f"DEBUG: update_data (exclude_unset) = {update_data}")  # Debug log

    # Vérifier si on essaie de changer le nom
    if 'name' in update_data and update_data['name']:
        if company.name_changed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le nom de l'entreprise ne peut être modifié qu'une seule fois"
            )
        # Marquer que le nom a été changé
        company.name_changed = True

    # Si on change le account_type, mettre à jour aussi le subscription_plan
    if 'account_type' in update_data and update_data['account_type']:
        new_type = update_data['account_type']
        if new_type == 'personal':
            update_data['subscription_plan'] = SubscriptionPlan.PERSONAL.value if hasattr(SubscriptionPlan, 'PERSONAL') else 'personal'
        elif new_type == 'business':
            update_data['subscription_plan'] = SubscriptionPlan.BUSINESS.value if hasattr(SubscriptionPlan, 'BUSINESS') else 'business'

    for field, value in update_data.items():
        print(f"DEBUG: Setting {field} = {value}")  # Debug log
        setattr(company, field, value if value != '' else None)

    db.commit()
    db.refresh(company)

    return company


@router.post("/me/companies/{company_id}/set-default")
async def set_default_company(
    company_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Définir une entreprise comme entreprise par défaut"""
    # Vérifier l'accès
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if not user_company:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas accès à cette entreprise"
        )

    # Retirer le flag default des autres entreprises
    db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.is_default == True
    ).update({"is_default": False})

    # Définir cette entreprise comme défaut
    user_company.is_default = True
    db.commit()

    return {"message": "Entreprise par défaut mise à jour"}


@router.post("/me/company/logo", response_model=CompanyResponse)
async def upload_company_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Uploader le logo de l'entreprise courante"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les droits admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour modifier cette entreprise"
        )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    # Vérifier le type de fichier
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier non autorisé. Utilisez JPEG, PNG, GIF ou WebP."
        )

    from app.core.s3 import s3_enabled, upload_to_s3, delete_from_s3

    # Supprimer l'ancien logo
    if company.logo_url:
        if s3_enabled() and (company.logo_url.startswith("http") or company.logo_url.startswith("/api/files/")):
            delete_from_s3(company.logo_url)
        elif company.logo_url.startswith("/uploads/"):
            old_path = os.path.join(UPLOAD_DIR, company.logo_url.split("/")[-1])
            if os.path.exists(old_path):
                os.remove(old_path)

    if s3_enabled():
        logo_url = await upload_to_s3(file, folder="logos")
    else:
        ext = file.filename.split(".")[-1] if "." in file.filename else "png"
        filename = f"company_{company_id}_logo_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logo_url = f"/uploads/{filename}"

    company.logo_url = logo_url
    db.commit()
    db.refresh(company)

    return company


@router.delete("/me/company/logo", response_model=CompanyResponse)
async def delete_company_logo(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer le logo de l'entreprise courante"""
    from app.core.s3 import s3_enabled, delete_from_s3

    company_id = current_user.current_company_id or current_user.company_id

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    if company.logo_url:
        if s3_enabled() and (company.logo_url.startswith("http") or company.logo_url.startswith("/api/files/")):
            delete_from_s3(company.logo_url)
        elif company.logo_url.startswith("/uploads/"):
            old_path = os.path.join(UPLOAD_DIR, company.logo_url.split("/")[-1])
            if os.path.exists(old_path):
                os.remove(old_path)
        company.logo_url = None
        db.commit()
        db.refresh(company)

    return company


# ============ Company Settings (Comptabilité) ============

@router.get("/me/company/settings", response_model=CompanySettingsResponse)
async def get_company_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer les paramètres de comptabilité de l'entreprise courante"""
    company_id = current_user.current_company_id or current_user.company_id

    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    # Créer les paramètres par défaut si inexistants
    if not settings:
        settings = CompanySettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return CompanySettingsResponse.from_orm_with_smtp_status(settings)


@router.put("/me/company/settings", response_model=CompanySettingsResponse)
async def update_company_settings(
    data: CompanySettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour les paramètres de comptabilité de l'entreprise courante"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les droits admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour modifier ces paramètres"
        )

    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    # Créer si inexistant
    if not settings:
        settings = CompanySettings(company_id=company_id)
        db.add(settings)

    # Mettre à jour les champs
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Ne pas écraser le mot de passe SMTP si la valeur est le masque ou vide
        if field == 'smtp_password' and (value == '********' or value == ''):
            continue
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    return CompanySettingsResponse.from_orm_with_smtp_status(settings)


@router.post("/me/company/settings/logo", response_model=CompanySettingsResponse)
async def upload_settings_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Uploader le logo pour les documents (devis/factures)"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les droits admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour modifier ces paramètres"
        )

    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    if not settings:
        settings = CompanySettings(company_id=company_id)
        db.add(settings)

    # Vérifier le type de fichier
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier non autorisé. Utilisez JPEG, PNG, GIF ou WebP."
        )

    from app.core.s3 import s3_enabled, upload_to_s3, delete_from_s3

    # Supprimer l'ancien logo
    if settings.logo_url:
        if s3_enabled() and (settings.logo_url.startswith("http") or settings.logo_url.startswith("/api/files/")):
            delete_from_s3(settings.logo_url)
        elif settings.logo_url.startswith("/uploads/"):
            old_path = os.path.join(UPLOAD_DIR, settings.logo_url.split("/")[-1])
            if os.path.exists(old_path):
                os.remove(old_path)

    if s3_enabled():
        settings.logo_url = await upload_to_s3(file, folder="doc-logos")
    else:
        ext = file.filename.split(".")[-1] if "." in file.filename else "png"
        filename = f"company_{company_id}_doc_logo_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        settings.logo_url = f"/uploads/{filename}"

    db.commit()
    db.refresh(settings)

    return CompanySettingsResponse.from_orm_with_smtp_status(settings)


@router.delete("/me/company/settings/logo", response_model=CompanySettingsResponse)
async def delete_settings_logo(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer le logo des documents"""
    from app.core.s3 import s3_enabled, delete_from_s3

    company_id = current_user.current_company_id or current_user.company_id

    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    if settings and settings.logo_url:
        if s3_enabled() and (settings.logo_url.startswith("http") or settings.logo_url.startswith("/api/files/")):
            delete_from_s3(settings.logo_url)
        elif settings.logo_url.startswith("/uploads/"):
            old_path = os.path.join(UPLOAD_DIR, settings.logo_url.split("/")[-1])
            if os.path.exists(old_path):
                os.remove(old_path)
        settings.logo_url = None
        db.commit()
        db.refresh(settings)

    return CompanySettingsResponse.from_orm_with_smtp_status(settings) if settings else None


# ============ Code d'invitation & Espaces ============

def _generate_invite_code() -> str:
    """Générer un code d'invitation unique de 8 caractères"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8))


class InviteCodeResponse(BaseModel):
    invite_code: str


class JoinCompanyRequest(BaseModel):
    invite_code: str


class CreateSpaceRequest(BaseModel):
    """Créer un nouvel espace (personnel ou professionnel)"""
    account_type: str  # "personal" ou "business"
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.get("/me/company/invite-code", response_model=InviteCodeResponse)
async def get_invite_code(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer ou générer le code d'invitation de l'entreprise courante"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les droits admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent voir le code d'invitation"
        )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    # Générer le code s'il n'existe pas
    if not company.invite_code:
        company.invite_code = _generate_invite_code()
        # S'assurer de l'unicité
        while db.query(Company).filter(Company.invite_code == company.invite_code, Company.id != company.id).first():
            company.invite_code = _generate_invite_code()
        db.commit()

    return InviteCodeResponse(invite_code=company.invite_code)


@router.post("/me/company/invite-code/regenerate", response_model=InviteCodeResponse)
async def regenerate_invite_code(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Régénérer le code d'invitation de l'entreprise courante"""
    company_id = current_user.current_company_id or current_user.company_id

    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent régénérer le code d'invitation"
        )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")

    company.invite_code = _generate_invite_code()
    while db.query(Company).filter(Company.invite_code == company.invite_code, Company.id != company.id).first():
        company.invite_code = _generate_invite_code()
    db.commit()

    return InviteCodeResponse(invite_code=company.invite_code)


@router.post("/me/join-company")
async def join_company(
    request: JoinCompanyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Rejoindre une entreprise via un code d'invitation"""
    # Trouver l'entreprise par code d'invitation
    company = db.query(Company).filter(
        Company.invite_code == request.invite_code.upper(),
        Company.is_active == True
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Code d'invitation invalide"
        )

    # Vérifier que l'utilisateur n'est pas déjà membre
    existing = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous êtes déjà membre de cette entreprise"
        )

    # Ajouter l'utilisateur comme MEMBER
    user_company = UserCompany(
        user_id=current_user.id,
        company_id=company.id,
        role=UserCompanyRole.MEMBER,
        is_default=False
    )
    db.add(user_company)

    # Changer l'entreprise courante
    current_user.current_company_id = company.id
    db.commit()

    return {
        "message": f"Vous avez rejoint {company.name} !",
        "company_id": company.id,
        "company_name": company.name
    }


@router.post("/me/create-space", response_model=CompanyResponse)
async def create_space(
    data: CreateSpaceRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer un nouvel espace (personnel ou professionnel) depuis un compte existant"""
    is_personal = (data.account_type == 'personal')
    account_type_enum = AccountType.PERSONAL if is_personal else AccountType.BUSINESS
    subscription_plan = SubscriptionPlan.PERSONAL if is_personal else SubscriptionPlan.BUSINESS

    # Nom de l'espace
    space_name = data.name or current_user.full_name
    if not space_name:
        raise HTTPException(status_code=400, detail="Le nom est requis")

    # Générer le slug
    import re
    base_slug = re.sub(r'[^a-z0-9]+', '-', space_name.lower()).strip('-')
    slug = base_slug
    counter = 1
    while db.query(Company).filter(Company.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Créer l'entreprise/espace
    new_company = Company(
        name=space_name,
        slug=slug,
        email=data.email or current_user.email,
        phone=data.phone,
        account_type=account_type_enum,
        subscription_plan=subscription_plan,
        is_active=True
    )
    db.add(new_company)
    db.flush()

    # Lier l'utilisateur comme OWNER
    user_company = UserCompany(
        user_id=current_user.id,
        company_id=new_company.id,
        role=UserCompanyRole.OWNER,
        is_default=False
    )
    db.add(user_company)

    # Changer l'entreprise courante
    current_user.current_company_id = new_company.id
    db.commit()
    db.refresh(new_company)

    # Seeder les catégories par défaut pour les comptes personnels
    if is_personal:
        from app.api.routes.auth import _seed_personal_defaults
        _seed_personal_defaults(db, new_company.id)

    return new_company


@router.delete("/me/space/{company_id}")
async def delete_space(
    company_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer un espace (personnel ou professionnel) dont l'utilisateur est propriétaire"""
    # Vérifier que l'utilisateur est OWNER de cet espace
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if not user_company or user_company.role != UserCompanyRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le propriétaire peut supprimer cet espace"
        )

    # Empêcher la suppression du dernier espace
    user_spaces = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id
    ).count()

    if user_spaces <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer votre dernier espace"
        )

    # Si c'est l'espace courant, basculer vers un autre
    if current_user.current_company_id == company_id:
        other_uc = db.query(UserCompany).filter(
            UserCompany.user_id == current_user.id,
            UserCompany.company_id != company_id
        ).first()
        if other_uc:
            current_user.current_company_id = other_uc.company_id

    # Supprimer toutes les données liées à cet espace
    # 1. Tables enfants sans company_id direct (liées via parents)
    # invoice_line_items & invoice_payments → via invoices
    invoice_ids = [i.id for i in db.query(Invoice).filter(Invoice.company_id == company_id).all()]
    if invoice_ids:
        db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id.in_(invoice_ids)).delete(synchronize_session=False)
        db.query(InvoicePayment).filter(InvoicePayment.invoice_id.in_(invoice_ids)).delete(synchronize_session=False)

    # quote_line_items → via quotes
    quote_ids = [q.id for q in db.query(Quote).filter(Quote.company_id == company_id).all()]
    if quote_ids:
        db.query(QuoteLineItem).filter(QuoteLineItem.quote_id.in_(quote_ids)).delete(synchronize_session=False)

    # client_attachments → via clients
    client_ids = [c.id for c in db.query(Client).filter(Client.company_id == company_id).all()]
    if client_ids:
        db.query(ClientAttachment).filter(ClientAttachment.client_id.in_(client_ids)).delete(synchronize_session=False)

    # sales_goals → via employees
    employee_ids = [e.id for e in db.query(Employee).filter(Employee.company_id == company_id).all()]
    if employee_ids:
        db.query(SalesGoal).filter(SalesGoal.employee_id.in_(employee_ids)).delete(synchronize_session=False)

    # bank_accounts → via company_settings
    settings = db.query(CompanySettings).filter(CompanySettings.company_id == company_id).first()
    if settings:
        db.query(BankAccount).filter(BankAccount.company_settings_id == settings.id).delete(synchronize_session=False)

    # 2. Tables avec company_id direct (ordre : enfants d'abord)
    db.query(PaymentRetry).filter(PaymentRetry.company_id == company_id).delete(synchronize_session=False)
    db.query(SubscriptionHistory).filter(SubscriptionHistory.company_id == company_id).delete(synchronize_session=False)
    db.query(PaymentTransaction).filter(PaymentTransaction.company_id == company_id).delete(synchronize_session=False)
    db.query(Invoice).filter(Invoice.company_id == company_id).delete(synchronize_session=False)
    db.query(Quote).filter(Quote.company_id == company_id).delete(synchronize_session=False)
    db.query(Client).filter(Client.company_id == company_id).delete(synchronize_session=False)
    db.query(SavingsCategory).filter(SavingsCategory.company_id == company_id).delete(synchronize_session=False)
    db.query(VatRate).filter(VatRate.company_id == company_id).delete(synchronize_session=False)
    db.query(BankImport).filter(BankImport.company_id == company_id).delete(synchronize_session=False)
    db.query(BudgetCategory).filter(BudgetCategory.company_id == company_id).delete(synchronize_session=False)
    db.query(CategoryRule).filter(CategoryRule.company_id == company_id).delete(synchronize_session=False)
    db.query(Category).filter(Category.company_id == company_id).delete(synchronize_session=False)
    db.query(Document).filter(Document.company_id == company_id).delete(synchronize_session=False)
    db.query(TimeEntry).filter(TimeEntry.company_id == company_id).delete(synchronize_session=False)
    db.query(TimeCategory).filter(TimeCategory.company_id == company_id).delete(synchronize_session=False)
    db.query(Employee).filter(Employee.company_id == company_id).delete(synchronize_session=False)
    db.query(Transaction).filter(Transaction.company_id == company_id).delete(synchronize_session=False)
    db.query(Budget).filter(Budget.company_id == company_id).delete(synchronize_session=False)
    if settings:
        db.query(CompanySettings).filter(CompanySettings.id == settings.id).delete(synchronize_session=False)

    # 3. Mettre à jour les users qui ont cet espace comme company_id principal
    db.query(User).filter(User.company_id == company_id).update(
        {"company_id": current_user.current_company_id}, synchronize_session=False
    )

    # 4. Supprimer les liaisons user_companies pour TOUS les utilisateurs de cet espace
    db.query(UserCompany).filter(UserCompany.company_id == company_id).delete(synchronize_session=False)

    # 5. Supprimer l'entreprise
    company = db.query(Company).filter(Company.id == company_id).first()
    if company:
        db.delete(company)

    db.commit()

    return {"message": "Espace supprimé avec succès"}


# ============ Bank Accounts (RIB) ============

@router.get("/me/company/settings/bank-accounts/", response_model=list[BankAccountResponse])
async def get_bank_accounts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer tous les comptes bancaires de l'entreprise"""
    company_id = current_user.current_company_id or current_user.company_id

    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    if not settings:
        return []

    return sorted(settings.bank_accounts, key=lambda x: x.position)


@router.post("/me/company/settings/bank-accounts/", response_model=BankAccountResponse)
async def create_bank_account(
    data: BankAccountCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Ajouter un compte bancaire"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les droits admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour modifier ces paramètres"
        )

    # Récupérer ou créer les settings
    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    if not settings:
        settings = CompanySettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Si c'est le premier compte ou marqué par défaut, s'assurer qu'il n'y a qu'un seul défaut
    if data.is_default:
        db.query(BankAccount).filter(
            BankAccount.company_settings_id == settings.id,
            BankAccount.is_default == True
        ).update({"is_default": False})

    # Déterminer la position
    max_position = db.query(BankAccount).filter(
        BankAccount.company_settings_id == settings.id
    ).count()

    bank_account = BankAccount(
        company_settings_id=settings.id,
        label=data.label,
        bank_name=data.bank_name,
        account_holder=data.account_holder,
        iban=data.iban,
        bic=data.bic,
        is_default=data.is_default or max_position == 0,  # Premier compte = par défaut
        position=max_position
    )
    db.add(bank_account)
    db.commit()
    db.refresh(bank_account)

    return bank_account


@router.put("/me/company/settings/bank-accounts/{account_id}/", response_model=BankAccountResponse)
async def update_bank_account(
    account_id: int,
    data: BankAccountUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Modifier un compte bancaire"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les droits admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour modifier ces paramètres"
        )

    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    if not settings:
        raise HTTPException(status_code=404, detail="Paramètres non trouvés")

    bank_account = db.query(BankAccount).filter(
        BankAccount.id == account_id,
        BankAccount.company_settings_id == settings.id
    ).first()

    if not bank_account:
        raise HTTPException(status_code=404, detail="Compte bancaire non trouvé")

    # Si marqué par défaut, retirer le flag des autres
    if data.is_default:
        db.query(BankAccount).filter(
            BankAccount.company_settings_id == settings.id,
            BankAccount.id != account_id,
            BankAccount.is_default == True
        ).update({"is_default": False})

    # Mettre à jour
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bank_account, field, value)

    db.commit()
    db.refresh(bank_account)

    return bank_account


@router.delete("/me/company/settings/bank-accounts/{account_id}/")
async def delete_bank_account(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer un compte bancaire"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les droits admin
    user_company = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == company_id
    ).first()

    if user_company and user_company.role not in [UserCompanyRole.OWNER, UserCompanyRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour modifier ces paramètres"
        )

    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    if not settings:
        raise HTTPException(status_code=404, detail="Paramètres non trouvés")

    bank_account = db.query(BankAccount).filter(
        BankAccount.id == account_id,
        BankAccount.company_settings_id == settings.id
    ).first()

    if not bank_account:
        raise HTTPException(status_code=404, detail="Compte bancaire non trouvé")

    was_default = bank_account.is_default
    db.delete(bank_account)
    db.commit()

    # Si c'était le compte par défaut, en définir un autre
    if was_default:
        remaining = db.query(BankAccount).filter(
            BankAccount.company_settings_id == settings.id
        ).order_by(BankAccount.position).first()
        if remaining:
            remaining.is_default = True
            db.commit()

    return {"message": "Compte bancaire supprimé"}
