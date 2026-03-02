"""
Schémas Pydantic pour l'authentification
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.db.models import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str
    company_id: int
    role: UserRole = UserRole.EMPLOYEE


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    role: UserRole
    company_id: int
    is_active: bool
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None


class OAuthCallback(BaseModel):
    code: str
    state: Optional[str] = None


# Schémas pour l'inscription d'une nouvelle entreprise
class CompanyCreate(BaseModel):
    """Informations de l'entreprise pour l'inscription"""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "France"
    vat_number: Optional[str] = None


class RegisterRequest(BaseModel):
    """Requête d'inscription complète (entreprise + admin)"""
    # Informations entreprise
    company: CompanyCreate

    # Informations utilisateur admin
    email: EmailStr
    password: str
    full_name: str


class RegisterResponse(BaseModel):
    """Réponse après inscription réussie"""
    message: str
    user: UserResponse
    company_name: str
    access_token: str
    token_type: str = "bearer"
