"""
Routes pour la gestion des clients (CRM)
"""
import csv
import io
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum

from app.db.database import get_db
from app.db.models import User, Client, ClientType, ClientAttachment
from app.core.security import get_current_active_user
from app.core.config import settings

router = APIRouter(tags=["clients"])

# Dossier pour les pièces jointes clients
CLIENT_ATTACHMENTS_DIR = os.path.join(settings.UPLOAD_DIR, "client_attachments")
os.makedirs(CLIENT_ATTACHMENTS_DIR, exist_ok=True)

# Types de fichiers autorisés pour les pièces jointes
ALLOWED_ATTACHMENT_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10 MB


# ============== Schemas ==============

class ClientTypeEnum(str, Enum):
    personal = "personal"
    professional = "professional"


class AttachmentResponse(BaseModel):
    id: int
    filename: str
    file_type: Optional[str]
    file_size: Optional[int]
    description: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ClientCreate(BaseModel):
    client_type: ClientTypeEnum = ClientTypeEnum.personal
    name: str  # Nom (perso) ou Nom du contact (pro)
    first_name: Optional[str] = None  # Prénom
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "France"
    # Champs professionnels
    company_name: Optional[str] = None
    vat_number: Optional[str] = None
    siret: Optional[str] = None
    contact_position: Optional[str] = None
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    client_type: Optional[ClientTypeEnum] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    company_name: Optional[str] = None
    vat_number: Optional[str] = None
    siret: Optional[str] = None
    contact_position: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(BaseModel):
    id: int
    client_type: str
    name: str
    first_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    city: Optional[str]
    postal_code: Optional[str]
    country: Optional[str]
    company_name: Optional[str]
    vat_number: Optional[str]
    siret: Optional[str]
    contact_position: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentResponse] = []

    class Config:
        from_attributes = True


class ImportCSVResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


# ============== Routes ==============

@router.get("/", response_model=List[ClientResponse])
async def get_clients(
    search: Optional[str] = None,
    client_type: Optional[ClientTypeEnum] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer tous les clients de l'entreprise"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(Client).options(
        joinedload(Client.attachments)
    ).filter(
        Client.company_id == company_id,
        Client.is_active == True
    )

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Client.name.ilike(search_term)) |
            (Client.first_name.ilike(search_term)) |
            (Client.email.ilike(search_term)) |
            (Client.company_name.ilike(search_term)) |
            (Client.phone.ilike(search_term))
        )

    if client_type:
        query = query.filter(Client.client_type == client_type.value)

    return query.order_by(Client.name).all()


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer un client par ID"""
    company_id = current_user.current_company_id or current_user.company_id

    client = db.query(Client).options(
        joinedload(Client.attachments)
    ).filter(
        Client.id == client_id,
        Client.company_id == company_id,
        Client.is_active == True
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client non trouvé"
        )

    return client


class DuplicateClientResponse(BaseModel):
    is_duplicate: bool
    existing_client: Optional[ClientResponse] = None
    message: str


@router.post("/", response_model=ClientResponse)
async def create_client(
    data: ClientCreate,
    force: bool = False,  # Si True, crée même si doublon potentiel
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer un nouveau client"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier les doublons potentiels
    if not force:
        existing = None

        # Vérifier par email (si fourni)
        if data.email:
            existing = db.query(Client).options(
                joinedload(Client.attachments)
            ).filter(
                Client.company_id == company_id,
                Client.email == data.email,
                Client.is_active == True
            ).first()

        # Vérifier par nom + entreprise (pour les pros)
        if not existing and data.client_type == ClientTypeEnum.professional and data.company_name:
            existing = db.query(Client).options(
                joinedload(Client.attachments)
            ).filter(
                Client.company_id == company_id,
                Client.company_name == data.company_name,
                Client.is_active == True
            ).first()

        # Vérifier par nom + prénom (pour les particuliers)
        if not existing and data.client_type == ClientTypeEnum.personal:
            query = db.query(Client).options(
                joinedload(Client.attachments)
            ).filter(
                Client.company_id == company_id,
                Client.name == data.name,
                Client.is_active == True
            )
            if data.first_name:
                query = query.filter(Client.first_name == data.first_name)
            existing = query.first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Un client similaire existe déjà",
                    "existing_client_id": existing.id,
                    "existing_client_name": f"{existing.first_name or ''} {existing.name}".strip() if existing.client_type == 'personal' else existing.company_name or existing.name
                }
            )

    client = Client(
        company_id=company_id,
        **data.model_dump()
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return client


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    data: ClientUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour un client"""
    company_id = current_user.current_company_id or current_user.company_id

    client = db.query(Client).filter(
        Client.id == client_id,
        Client.company_id == company_id,
        Client.is_active == True
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client non trouvé"
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)

    return client


@router.delete("/{client_id}")
async def delete_client(
    client_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer (désactiver) un client"""
    company_id = current_user.current_company_id or current_user.company_id

    client = db.query(Client).filter(
        Client.id == client_id,
        Client.company_id == company_id
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client non trouvé"
        )

    client.is_active = False
    db.commit()

    return {"message": "Client supprimé"}


@router.post("/import-csv", response_model=ImportCSVResponse)
async def import_clients_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Importer des clients depuis un fichier CSV

    Format attendu du CSV (colonnes possibles):
    - name (obligatoire)
    - email
    - phone
    - address
    - city
    - postal_code
    - country
    - company_name
    - vat_number
    - siret
    - contact_name
    - contact_position
    - notes
    """
    company_id = current_user.current_company_id or current_user.company_id

    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier doit être au format CSV"
        )

    try:
        content = await file.read()
        # Essayer différents encodages
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de décoder le fichier CSV"
            )

        # Détecter le délimiteur
        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(text[:2000])
            delimiter = dialect.delimiter
        except csv.Error:
            delimiter = ';' if ';' in text else ','

        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

        # Normaliser les noms de colonnes
        if reader.fieldnames:
            reader.fieldnames = [f.strip().lower().replace(' ', '_') for f in reader.fieldnames]

        imported = 0
        skipped = 0
        errors = []

        # Mapping des colonnes possibles
        field_mapping = {
            'nom': 'name',
            'name': 'name',
            'client': 'name',
            'societe': 'company_name',
            'société': 'company_name',
            'entreprise': 'company_name',
            'company': 'company_name',
            'company_name': 'company_name',
            'mail': 'email',
            'e-mail': 'email',
            'email': 'email',
            'telephone': 'phone',
            'téléphone': 'phone',
            'tel': 'phone',
            'phone': 'phone',
            'adresse': 'address',
            'address': 'address',
            'ville': 'city',
            'city': 'city',
            'code_postal': 'postal_code',
            'cp': 'postal_code',
            'postal_code': 'postal_code',
            'pays': 'country',
            'country': 'country',
            'tva': 'vat_number',
            'vat': 'vat_number',
            'vat_number': 'vat_number',
            'siret': 'siret',
            'contact': 'contact_name',
            'contact_name': 'contact_name',
            'fonction': 'contact_position',
            'position': 'contact_position',
            'contact_position': 'contact_position',
            'notes': 'notes',
            'commentaire': 'notes',
            'commentaires': 'notes',
        }

        for row_num, row in enumerate(reader, start=2):
            try:
                # Construire les données du client
                client_data = {}

                for csv_col, value in row.items():
                    if csv_col and value:
                        normalized_col = csv_col.strip().lower().replace(' ', '_')
                        if normalized_col in field_mapping:
                            db_field = field_mapping[normalized_col]
                            client_data[db_field] = value.strip()

                # Vérifier que le nom est présent
                if 'name' not in client_data or not client_data['name']:
                    skipped += 1
                    errors.append(f"Ligne {row_num}: nom manquant")
                    continue

                # Vérifier si le client existe déjà (par email ou nom+entreprise)
                existing = None
                if client_data.get('email'):
                    existing = db.query(Client).filter(
                        Client.company_id == company_id,
                        Client.email == client_data['email'],
                        Client.is_active == True
                    ).first()

                if not existing and client_data.get('company_name'):
                    existing = db.query(Client).filter(
                        Client.company_id == company_id,
                        Client.name == client_data['name'],
                        Client.company_name == client_data.get('company_name'),
                        Client.is_active == True
                    ).first()

                if existing:
                    skipped += 1
                    continue

                # Créer le client
                client = Client(
                    company_id=company_id,
                    **client_data
                )
                db.add(client)
                imported += 1

            except Exception as e:
                skipped += 1
                errors.append(f"Ligne {row_num}: {str(e)}")

        db.commit()

        return ImportCSVResponse(
            imported=imported,
            skipped=skipped,
            errors=errors[:10]  # Limiter les erreurs retournées
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'import: {str(e)}"
        )


# ============== Routes Pièces Jointes ==============

@router.post("/{client_id}/attachments", response_model=AttachmentResponse)
async def upload_client_attachment(
    client_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Ajouter une pièce jointe à un client professionnel"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le client existe et appartient à l'entreprise
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.company_id == company_id,
        Client.is_active == True
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client non trouvé"
        )

    # Vérifier le type de fichier
    if file.content_type not in ALLOWED_ATTACHMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non autorisé. Types acceptés: PDF, JPEG, PNG, WEBP, DOC, DOCX"
        )

    # Lire le contenu et vérifier la taille
    content = await file.read()
    if len(content) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop volumineux. Taille max: {MAX_ATTACHMENT_SIZE // (1024*1024)} MB"
        )

    # Générer un nom de fichier unique
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    stored_filename = f"{company_id}_{client_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(CLIENT_ATTACHMENTS_DIR, stored_filename)

    # Sauvegarder le fichier
    with open(file_path, "wb") as f:
        f.write(content)

    # Créer l'enregistrement en base
    attachment = ClientAttachment(
        client_id=client_id,
        filename=file.filename or "document",
        stored_filename=stored_filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=len(content),
        description=description
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.get("/{client_id}/attachments", response_model=List[AttachmentResponse])
async def get_client_attachments(
    client_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer toutes les pièces jointes d'un client"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le client existe et appartient à l'entreprise
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.company_id == company_id,
        Client.is_active == True
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client non trouvé"
        )

    return db.query(ClientAttachment).filter(
        ClientAttachment.client_id == client_id
    ).order_by(ClientAttachment.uploaded_at.desc()).all()


@router.get("/{client_id}/attachments/{attachment_id}/download")
async def download_client_attachment(
    client_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Télécharger une pièce jointe"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le client existe et appartient à l'entreprise
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.company_id == company_id,
        Client.is_active == True
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client non trouvé"
        )

    attachment = db.query(ClientAttachment).filter(
        ClientAttachment.id == attachment_id,
        ClientAttachment.client_id == client_id
    ).first()

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pièce jointe non trouvée"
        )

    if not os.path.exists(attachment.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier non trouvé sur le serveur"
        )

    return FileResponse(
        path=attachment.file_path,
        filename=attachment.filename,
        media_type=attachment.file_type
    )


@router.delete("/{client_id}/attachments/{attachment_id}")
async def delete_client_attachment(
    client_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer une pièce jointe"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le client existe et appartient à l'entreprise
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.company_id == company_id,
        Client.is_active == True
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client non trouvé"
        )

    attachment = db.query(ClientAttachment).filter(
        ClientAttachment.id == attachment_id,
        ClientAttachment.client_id == client_id
    ).first()

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pièce jointe non trouvée"
        )

    # Supprimer le fichier physique
    if os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)

    # Supprimer l'enregistrement
    db.delete(attachment)
    db.commit()

    return {"message": "Pièce jointe supprimée"}
