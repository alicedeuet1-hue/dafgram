"""Routes pour l'upload et le traitement de documents"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import json
from datetime import datetime
from app.db.database import get_db
from app.db.models import Document, Transaction, TransactionType, User
from app.schemas.document import DocumentResponse, DocumentUploadResponse, ProcessedData
from app.core.security import get_current_active_user
from app.core.config import settings
from app.services.document_parser import DocumentParser

router = APIRouter(tags=["documents"])

# Créer le dossier d'uploads s'il n'existe pas
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


def check_company_access_document(document: Document, user: User):
    """Vérifier que l'utilisateur a accès à ce document"""
    if document.company_id != user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this document"
        )


@router.get("/", response_model=List[DocumentResponse])
async def get_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer tous les documents de l'entreprise"""
    documents = db.query(Document).filter(
        Document.company_id == current_user.company_id
    ).order_by(Document.created_at.desc()).offset(skip).limit(limit).all()

    return documents


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer un document par ID"""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    check_company_access_document(document, current_user)
    return document


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    auto_process: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload un document (PDF ou CSV) et le traite automatiquement
    """
    # Vérifier le type de fichier
    allowed_extensions = ['.pdf', '.csv', '.xlsx']
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
        )

    # Lire le fichier
    contents = await file.read()
    file_size = len(contents)

    # Vérifier la taille
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )

    # Créer un nom de fichier unique
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{current_user.company_id}_{timestamp}_{file.filename}"
    filepath = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # Sauvegarder le fichier
    with open(filepath, "wb") as f:
        f.write(contents)

    # Créer l'entrée dans la base de données
    new_document = Document(
        company_id=current_user.company_id,
        filename=file.filename,
        filepath=filepath,
        file_type=file_ext,
        file_size=file_size,
        uploaded_by=current_user.id,
        processed=False
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    transactions_created = 0

    # Traiter le document automatiquement si demandé
    if auto_process:
        try:
            # Parser le document
            parser = DocumentParser()
            parsed_data = parser.parse_document(filepath)

            # Sauvegarder les données extraites
            new_document.extracted_data = json.dumps(parsed_data, default=str)

            # Créer les transactions automatiquement
            for trans_data in parsed_data.get('transactions', []):
                # Déterminer si c'est une dépense ou un revenu (montant négatif = dépense)
                amount = trans_data.get('amount', 0)
                trans_type = TransactionType.EXPENSE if amount < 0 else TransactionType.REVENUE

                new_transaction = Transaction(
                    company_id=current_user.company_id,
                    type=trans_type,
                    amount=abs(amount),
                    description=trans_data.get('description', ''),
                    transaction_date=trans_data.get('date') or datetime.utcnow(),
                    source_file=filepath,
                    auto_imported=True
                )

                db.add(new_transaction)
                transactions_created += 1

            if parsed_data.get('errors'):
                new_document.processing_error = "; ".join(parsed_data['errors'])

            new_document.processed = True
            db.commit()
            db.refresh(new_document)

        except Exception as e:
            new_document.processing_error = str(e)
            new_document.processed = False
            db.commit()
            db.refresh(new_document)

    return DocumentUploadResponse(
        message="Document uploaded successfully",
        document=new_document,
        transactions_created=transactions_created
    )


@router.post("/{document_id}/process", response_model=ProcessedData)
async def process_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Traiter manuellement un document déjà uploadé
    """
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    check_company_access_document(document, current_user)

    try:
        # Parser le document
        parser = DocumentParser()
        parsed_data = parser.parse_document(document.filepath)

        # Sauvegarder les données
        document.extracted_data = json.dumps(parsed_data, default=str)
        document.processed = True

        if parsed_data.get('errors'):
            document.processing_error = "; ".join(parsed_data['errors'])

        db.commit()

        return ProcessedData(**parsed_data)

    except Exception as e:
        document.processing_error = str(e)
        document.processed = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing document: {str(e)}"
        )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer un document"""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    check_company_access_document(document, current_user)

    # Supprimer le fichier physique
    if os.path.exists(document.filepath):
        os.remove(document.filepath)

    # Supprimer de la base de données
    db.delete(document)
    db.commit()

    return None
