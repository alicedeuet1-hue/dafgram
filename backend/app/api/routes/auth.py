"""
Routes d'authentification (JWT + OAuth2)
"""
import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
import httpx
from authlib.integrations.starlette_client import OAuth

from app.db.database import get_db
from app.db.models import (
    User, UserRole, Company, UserCompany, UserCompanyRole,
    AccountType, SubscriptionPlan, Category, TransactionType, SavingsCategory,
    BudgetCategory,
)
from app.core.config import settings

# Dossier pour stocker les uploads
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)
from app.schemas.auth import (
    UserCreate, UserLogin, UserResponse, Token, OAuthCallback,
    RegisterRequest, RegisterResponse
)
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user
)
from app.core.config import settings

router = APIRouter(tags=["authentication"])

# Configuration OAuth
oauth = OAuth()

# Google OAuth
if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

# Microsoft OAuth
if settings.MICROSOFT_CLIENT_ID and settings.MICROSOFT_CLIENT_SECRET:
    oauth.register(
        name='microsoft',
        client_id=settings.MICROSOFT_CLIENT_ID,
        client_secret=settings.MICROSOFT_CLIENT_SECRET,
        authorize_url='https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        access_token_url='https://login.microsoftonline.com/common/oauth2/v2.0/token',
        client_kwargs={'scope': 'openid email profile'}
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Enregistrer un nouvel utilisateur (dans une entreprise existante)"""
    # Vérifier si l'email existe déjà
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Créer l'utilisateur
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        role=user_data.role,
        company_id=user_data.company_id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def generate_slug(name: str, db: Session) -> str:
    """Génère un slug unique à partir du nom de l'entreprise"""
    import re
    # Convertir en minuscules et remplacer les espaces par des tirets
    base_slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    slug = base_slug

    # Vérifier l'unicité et ajouter un numéro si nécessaire
    counter = 1
    while db.query(Company).filter(Company.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


def _seed_personal_defaults(db: Session, company_id: int):
    """Créer les catégories par défaut pour un compte personnel."""
    # Catégories de dépenses personnelles (règle 50/30/20)
    expense_categories = [
        {"name": "Quotidien", "color": "#3B82F6", "budget_pct": 50},
        {"name": "Plaisirs", "color": "#8B5CF6", "budget_pct": 30},
    ]
    for cat_data in expense_categories:
        db.add(Category(
            company_id=company_id,
            name=cat_data["name"],
            type=TransactionType.EXPENSE,
            color=cat_data["color"],
        ))

    # Catégories de revenus personnels
    income_categories = [
        {"name": "Salaire", "color": "#10B981"},
        {"name": "Freelance", "color": "#3B82F6"},
        {"name": "Autres revenus", "color": "#F5C518"},
    ]
    for cat_data in income_categories:
        db.add(Category(
            company_id=company_id,
            name=cat_data["name"],
            type=TransactionType.REVENUE,
            color=cat_data["color"],
        ))

    # Flush pour obtenir les IDs des catégories
    db.flush()

    # Créer les BudgetCategories avec les pourcentages 50/30/20
    for cat_data in expense_categories:
        category = db.query(Category).filter(
            Category.company_id == company_id,
            Category.name == cat_data["name"],
            Category.type == TransactionType.EXPENSE,
        ).first()
        if category:
            db.add(BudgetCategory(
                company_id=company_id,
                category_id=category.id,
                percentage=cat_data["budget_pct"],
                is_savings=False,
                period_month=None,
                period_year=None,
            ))

    # Sous-catégories de dépenses
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
    for parent_name, children in subcategories.items():
        parent = db.query(Category).filter(
            Category.company_id == company_id,
            Category.name == parent_name,
            Category.type == TransactionType.EXPENSE,
        ).first()
        if parent:
            for sub in children:
                db.add(Category(
                    company_id=company_id,
                    name=sub["name"],
                    type=TransactionType.EXPENSE,
                    color=sub["color"],
                    parent_id=parent.id,
                ))

    # Budget épargne (20%)
    db.add(BudgetCategory(
        company_id=company_id,
        category_id=None,
        percentage=20,
        is_savings=True,
        period_month=None,
        period_year=None,
    ))

    # Catégories d'épargne personnelles (sous-catégories du 20%)
    savings = [
        {"name": "Trading long terme", "description": "Investissements et trading long terme", "color": "#F59E0B", "percentage": 50},
        {"name": "Trading moyen terme", "description": "Trading et investissements moyen terme", "color": "#10B981", "percentage": 30},
        {"name": "Projet perso", "description": "Projets personnels à financer", "color": "#8B5CF6", "percentage": 20},
    ]
    for sav_data in savings:
        db.add(SavingsCategory(
            company_id=company_id,
            name=sav_data["name"],
            description=sav_data["description"],
            color=sav_data["color"],
            percentage=sav_data["percentage"],
            is_default=True,
        ))

    db.commit()


@router.post("/register/company", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_company(data: RegisterRequest, db: Session = Depends(get_db)):
    """
    Inscription complète : créer une nouvelle entreprise et son administrateur.
    L'utilisateur démarre avec un compte vierge (aucune donnée).
    """
    # Vérifier si l'email utilisateur existe déjà
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé"
        )

    # Vérifier si l'email entreprise existe déjà (si fourni)
    if data.company.email:
        existing_company_email = db.query(Company).filter(Company.email == data.company.email).first()
        if existing_company_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Une entreprise avec cet email existe déjà"
            )

    # Vérifier si le numéro de TVA existe déjà (si fourni)
    if data.company.vat_number:
        existing_vat = db.query(Company).filter(Company.vat_number == data.company.vat_number).first()
        if existing_vat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce numéro de TVA est déjà enregistré"
            )

    try:
        # Déterminer le type de compte
        is_personal = (data.company.account_type == 'personal')
        account_type_enum = AccountType.PERSONAL if is_personal else AccountType.BUSINESS
        subscription_plan = SubscriptionPlan.PERSONAL if is_personal else SubscriptionPlan.BUSINESS

        # 1. Créer l'entreprise
        company_name = data.company.name or data.full_name
        slug = generate_slug(company_name, db)
        new_company = Company(
            name=company_name,
            slug=slug,
            email=data.company.email,
            phone=data.company.phone,
            address=data.company.address,
            city=data.company.city,
            postal_code=data.company.postal_code,
            country=data.company.country or "France",
            vat_number=data.company.vat_number if not is_personal else None,
            account_type=account_type_enum,
            subscription_plan=subscription_plan,
            is_active=True
        )
        db.add(new_company)
        db.flush()  # Pour obtenir l'ID sans commit

        # 2. Créer l'utilisateur administrateur
        hashed_password = get_password_hash(data.password)
        new_user = User(
            email=data.email,
            hashed_password=hashed_password,
            full_name=data.full_name,
            role=UserRole.COMPANY_ADMIN,
            company_id=new_company.id,
            current_company_id=new_company.id,
            is_active=True
        )
        db.add(new_user)
        db.flush()  # Pour obtenir l'ID utilisateur

        # 3. Créer la liaison UserCompany
        user_company = UserCompany(
            user_id=new_user.id,
            company_id=new_company.id,
            role=UserCompanyRole.OWNER,
            is_default=True
        )
        db.add(user_company)

        # 4. Commit de toutes les créations
        db.commit()
        db.refresh(new_company)
        db.refresh(new_user)

        # 5. Seeder les catégories par défaut pour les comptes personnels
        if is_personal:
            _seed_personal_defaults(db, new_company.id)

        # 4. Générer le token JWT pour connexion automatique
        access_token_expires = timedelta(minutes=settings.JWT_EXPIRES_MIN)
        access_token = create_access_token(
            data={
                "sub": new_user.email,
                "role": new_user.role.value,
                "company_id": new_company.id
            },
            expires_delta=access_token_expires
        )

        return RegisterResponse(
            message="Inscription réussie ! Bienvenue sur DafGram.",
            user=UserResponse(
                id=new_user.id,
                email=new_user.email,
                full_name=new_user.full_name,
                role=new_user.role,
                company_id=new_company.id,
                is_active=new_user.is_active
            ),
            company_name=new_company.name,
            access_token=access_token,
            token_type="bearer"
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'inscription: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Connexion avec email/password (JWT)"""
    # Trouver l'utilisateur
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Vérifier le mot de passe
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Créer le token
    access_token_expires = timedelta(minutes=settings.JWT_EXPIRES_MIN)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "company_id": user.company_id},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login/json", response_model=Token)
async def login_json(user_data: UserLogin, db: Session = Depends(get_db)):
    """Connexion avec JSON (alternative à OAuth2PasswordRequestForm)"""
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.JWT_EXPIRES_MIN)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "company_id": user.company_id},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Obtenir les informations de l'utilisateur connecté"""
    return current_user


# OAuth2 Routes (Google & Microsoft)
@router.get("/oauth/{provider}")
async def oauth_login(provider: str):
    """Initier la connexion OAuth (Google ou Microsoft)"""
    if provider not in ["google", "microsoft"]:
        raise HTTPException(status_code=400, detail="Provider not supported")

    if provider == "google" and not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    if provider == "microsoft" and not settings.MICROSOFT_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Microsoft OAuth not configured")

    # Retourner l'URL d'autorisation (à implémenter avec Starlette/FastAPI)
    return {
        "message": f"OAuth {provider} - Redirect to authorization URL",
        "note": "Full OAuth flow requires Starlette integration with session support"
    }


@router.post("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    callback_data: OAuthCallback,
    db: Session = Depends(get_db)
):
    """
    Callback OAuth après autorisation
    Note: Implémentation simplifiée. Pour une vraie implémentation,
    utilisez Authlib avec Starlette sessions.
    """
    # TODO: Implémenter la logique complète OAuth avec Authlib
    # 1. Échanger le code contre un access_token
    # 2. Récupérer les infos utilisateur
    # 3. Créer ou mettre à jour l'utilisateur
    # 4. Générer un JWT

    return {
        "message": "OAuth callback received",
        "note": "Full implementation requires Authlib integration"
    }


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Uploader la photo de profil de l'utilisateur"""
    from app.core.s3 import s3_enabled, upload_to_s3, delete_from_s3

    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier non autorisé. Utilisez JPEG, PNG, GIF ou WebP."
        )

    # Supprimer l'ancien avatar
    if current_user.avatar_url:
        if s3_enabled() and (current_user.avatar_url.startswith("http") or current_user.avatar_url.startswith("/api/files/")):
            delete_from_s3(current_user.avatar_url)
        elif current_user.avatar_url.startswith("/uploads/"):
            old_path = os.path.join(UPLOAD_DIR, current_user.avatar_url.split("/")[-1])
            if os.path.exists(old_path):
                os.remove(old_path)

    if s3_enabled():
        avatar_url = await upload_to_s3(file, folder="avatars")
    else:
        ext = file.filename.split(".")[-1] if "." in file.filename else "png"
        filename = f"user_{current_user.id}_avatar_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        avatar_url = f"/uploads/{filename}"

    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)

    return current_user


@router.delete("/me/avatar", response_model=UserResponse)
async def delete_avatar(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer la photo de profil de l'utilisateur"""
    from app.core.s3 import s3_enabled, delete_from_s3

    if current_user.avatar_url:
        if s3_enabled() and (current_user.avatar_url.startswith("http") or current_user.avatar_url.startswith("/api/files/")):
            delete_from_s3(current_user.avatar_url)
        elif current_user.avatar_url.startswith("/uploads/"):
            old_path = os.path.join(UPLOAD_DIR, current_user.avatar_url.split("/")[-1])
            if os.path.exists(old_path):
                os.remove(old_path)
        current_user.avatar_url = None
        db.commit()
        db.refresh(current_user)

    return current_user
