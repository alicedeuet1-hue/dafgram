"""
Routes pour l'import bancaire et la gestion des catégories/règles
"""
import os
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import (
    User, Transaction, TransactionType, Category, CategoryRule, BankImport, BankAccountType
)
from app.core.security import get_current_active_user
from app.services.bank_parser import (
    parse_csv_bank_statement,
    parse_pdf_bank_statement,
    apply_categorization_rules,
    BankParserError,
    ParseResult
)

router = APIRouter(tags=["bank-import"])


# ============== Schemas ==============

class CategoryCreate(BaseModel):
    name: str
    type: str  # 'revenue' ou 'expense'
    color: Optional[str] = "#6B7280"
    icon: Optional[str] = None
    parent_id: Optional[int] = None  # ID de la catégorie parente


class SubCategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    color: str
    icon: Optional[str]
    is_active: bool
    parent_id: Optional[int]

    class Config:
        from_attributes = True


class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    color: str
    icon: Optional[str]
    is_active: bool
    parent_id: Optional[int] = None
    subcategories: List[SubCategoryResponse] = []

    class Config:
        from_attributes = True


class CategoryRuleCreate(BaseModel):
    pattern: Optional[str] = None  # Optionnel si source_type est défini
    match_type: Optional[str] = "contains"  # contains, starts_with, exact, regex
    source_type: Optional[str] = None  # revenue, expense - filtre par type de transaction
    category_id: int
    transaction_type: Optional[str] = None
    priority: Optional[int] = 0


class CategoryRuleResponse(BaseModel):
    id: int
    pattern: Optional[str]
    match_type: str
    source_type: Optional[str]
    category_id: int
    transaction_type: Optional[str]
    priority: int
    is_active: bool
    category: CategoryResponse

    class Config:
        from_attributes = True


class BankImportResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    status: str
    transactions_imported: int
    transactions_skipped: int
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ImportPreviewTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category_id: Optional[int]
    category_name: Optional[str]
    is_duplicate: bool
    reference_hash: str


class ImportPreviewResponse(BaseModel):
    transactions: List[ImportPreviewTransaction]
    total_count: int
    duplicates_count: int
    categorized_count: int
    # Informations de debug
    total_lines: Optional[int] = None
    skipped_lines: Optional[int] = None
    skipped_reasons: Optional[dict] = None
    format_detected: Optional[dict] = None
    sample_skipped: Optional[List[dict]] = None


class ImportConfirmRequest(BaseModel):
    transactions: List[dict]  # Liste des transactions à importer avec leurs catégories


# ============== Catégories ==============

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    type: Optional[str] = None,
    include_subcategories: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer les catégories de l'entreprise (optionnellement avec sous-catégories)"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(Category).filter(
        Category.company_id == company_id,
        Category.is_active == True
    )

    if type:
        query = query.filter(Category.type == type)

    if include_subcategories:
        # Retourner seulement les catégories parentes avec leurs sous-catégories
        query = query.filter(Category.parent_id == None)

    categories = query.order_by(Category.name).all()

    # Construire la réponse avec les sous-catégories
    result = []
    for cat in categories:
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "type": cat.type.value if hasattr(cat.type, 'value') else cat.type,
            "color": cat.color,
            "icon": cat.icon,
            "is_active": cat.is_active,
            "parent_id": cat.parent_id,
            "subcategories": []
        }
        if include_subcategories and hasattr(cat, 'subcategories'):
            cat_dict["subcategories"] = [
                {
                    "id": sub.id,
                    "name": sub.name,
                    "type": sub.type.value if hasattr(sub.type, 'value') else sub.type,
                    "color": sub.color,
                    "icon": sub.icon,
                    "is_active": sub.is_active,
                    "parent_id": sub.parent_id
                }
                for sub in cat.subcategories if sub.is_active
            ]
        result.append(cat_dict)

    return result


@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer une nouvelle catégorie"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le type est valide
    if data.type not in ['revenue', 'expense']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le type doit être 'revenue' ou 'expense'"
        )

    # Si parent_id est fourni, vérifier qu'il existe et appartient à la même entreprise
    if data.parent_id:
        parent = db.query(Category).filter(
            Category.id == data.parent_id,
            Category.company_id == company_id,
            Category.is_active == True
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Catégorie parente non trouvée"
            )

    category = Category(
        company_id=company_id,
        name=data.name,
        type=TransactionType(data.type),
        color=data.color,
        icon=data.icon,
        parent_id=data.parent_id
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[int] = None  # None = pas de changement, 0 = retirer le parent


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour une catégorie (nom, couleur, parent)"""
    company_id = current_user.current_company_id or current_user.company_id

    category = db.query(Category).filter(
        Category.id == category_id,
        Category.company_id == company_id,
        Category.is_active == True
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    # Mise à jour du nom
    if data.name is not None:
        category.name = data.name

    # Mise à jour de la couleur
    if data.color is not None:
        category.color = data.color

    # Mise à jour de l'icône
    if data.icon is not None:
        category.icon = data.icon

    # Mise à jour du parent
    if data.parent_id is not None:
        if data.parent_id == 0:
            # Retirer le parent (rendre catégorie principale)
            category.parent_id = None
        else:
            # Vérifier que le parent existe et appartient à la même entreprise
            parent = db.query(Category).filter(
                Category.id == data.parent_id,
                Category.company_id == company_id,
                Category.is_active == True
            ).first()
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Catégorie parente non trouvée"
                )
            # Vérifier qu'on ne crée pas de boucle (le parent ne peut pas être soi-même ou un enfant)
            if data.parent_id == category_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Une catégorie ne peut pas être son propre parent"
                )
            # Vérifier que le parent n'est pas une sous-catégorie de cette catégorie
            if parent.parent_id == category_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Impossible de créer une boucle de catégories"
                )
            category.parent_id = data.parent_id

    db.commit()
    db.refresh(category)

    return category


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer (désactiver) une catégorie"""
    company_id = current_user.current_company_id or current_user.company_id

    category = db.query(Category).filter(
        Category.id == category_id,
        Category.company_id == company_id
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    category.is_active = False
    db.commit()

    return {"message": "Catégorie supprimée"}


# ============== Règles de catégorisation ==============

@router.get("/rules", response_model=List[CategoryRuleResponse])
async def get_categorization_rules(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer les règles de catégorisation"""
    company_id = current_user.current_company_id or current_user.company_id

    rules = db.query(CategoryRule).filter(
        CategoryRule.company_id == company_id,
        CategoryRule.is_active == True
    ).order_by(CategoryRule.priority.desc()).all()

    return rules


@router.post("/rules", response_model=CategoryRuleResponse)
async def create_categorization_rule(
    data: CategoryRuleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Créer une règle de catégorisation"""
    company_id = current_user.current_company_id or current_user.company_id

    # Validation: au moins un critère de correspondance (pattern ou source_type)
    if not data.pattern and not data.source_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un pattern ou un type de transaction source doit être défini"
        )

    # Vérifier que la catégorie existe
    category = db.query(Category).filter(
        Category.id == data.category_id,
        Category.company_id == company_id
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    rule = CategoryRule(
        company_id=company_id,
        pattern=data.pattern,
        match_type=data.match_type,
        source_type=TransactionType(data.source_type) if data.source_type else None,
        category_id=data.category_id,
        transaction_type=TransactionType(data.transaction_type) if data.transaction_type else None,
        priority=data.priority
    )

    db.add(rule)
    db.commit()
    db.refresh(rule)

    return rule


@router.put("/rules/{rule_id}", response_model=CategoryRuleResponse)
async def update_categorization_rule(
    rule_id: int,
    data: CategoryRuleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mettre à jour une règle de catégorisation"""
    company_id = current_user.current_company_id or current_user.company_id

    # Validation: au moins un critère de correspondance (pattern ou source_type)
    if not data.pattern and not data.source_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un pattern ou un type de transaction source doit être défini"
        )

    rule = db.query(CategoryRule).filter(
        CategoryRule.id == rule_id,
        CategoryRule.company_id == company_id
    ).first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Règle non trouvée"
        )

    rule.pattern = data.pattern
    rule.match_type = data.match_type
    rule.source_type = TransactionType(data.source_type) if data.source_type else None
    rule.category_id = data.category_id
    rule.transaction_type = TransactionType(data.transaction_type) if data.transaction_type else None
    rule.priority = data.priority

    db.commit()
    db.refresh(rule)

    return rule


@router.delete("/rules/{rule_id}")
async def delete_categorization_rule(
    rule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer une règle de catégorisation"""
    company_id = current_user.current_company_id or current_user.company_id

    rule = db.query(CategoryRule).filter(
        CategoryRule.id == rule_id,
        CategoryRule.company_id == company_id
    ).first()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Règle non trouvée"
        )

    rule.is_active = False
    db.commit()

    return {"message": "Règle supprimée"}


# ============== Import bancaire ==============

@router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_bank_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Prévisualiser les transactions d'un fichier bancaire.
    Retourne les transactions parsées avec les catégories suggérées.
    """
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier le type de fichier
    filename = file.filename.lower()
    if not (filename.endswith('.csv') or filename.endswith('.pdf')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format de fichier non supporté. Utilisez CSV ou PDF."
        )

    try:
        content = await file.read()

        parse_details = None

        if filename.endswith('.csv'):
            # Parser le CSV
            try:
                text_content = content.decode('utf-8')
            except UnicodeDecodeError:
                text_content = content.decode('latin-1')

            result = parse_csv_bank_statement(text_content, return_details=True)

            if isinstance(result, ParseResult):
                parsed_transactions = result.transactions
                parse_details = {
                    'total_lines': result.total_lines,
                    'parsed_lines': result.parsed_lines,
                    'skipped_lines': result.skipped_lines,
                    'skipped_reasons': result.skipped_reasons,
                    'format_detected': result.format_detected,
                    'sample_skipped': result.sample_skipped
                }
            else:
                parsed_transactions = result

        else:
            # Parser le PDF - nécessite de sauvegarder temporairement
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                parsed_transactions = parse_pdf_bank_statement(tmp_path)
            finally:
                os.unlink(tmp_path)

        if not parsed_transactions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune transaction n'a pu être extraite du fichier."
            )

        # Récupérer les règles de catégorisation
        rules = db.query(CategoryRule).filter(
            CategoryRule.company_id == company_id,
            CategoryRule.is_active == True
        ).order_by(CategoryRule.priority.desc()).all()

        rules_data = [
            {
                'id': r.id,
                'pattern': r.pattern,
                'match_type': r.match_type,
                'source_type': r.source_type.value if r.source_type else None,
                'category_id': r.category_id,
                'transaction_type': r.transaction_type.value if r.transaction_type else None
            }
            for r in rules
        ]

        # Appliquer les règles de catégorisation
        parsed_transactions = apply_categorization_rules(parsed_transactions, rules_data)

        # Récupérer les catégories pour les noms
        categories = {c.id: c.name for c in db.query(Category).filter(
            Category.company_id == company_id
        ).all()}

        # Vérifier les doublons
        existing_hashes = set(
            h[0] for h in db.query(Transaction.reference_hash).filter(
                Transaction.company_id == company_id,
                Transaction.reference_hash.isnot(None)
            ).all()
        )

        # Construire la réponse
        preview_transactions = []
        duplicates_count = 0
        categorized_count = 0

        for t in parsed_transactions:
            is_duplicate = t.reference_hash in existing_hashes
            category_id = t.raw_data.get('category_id')
            category_name = categories.get(category_id) if category_id else None

            if is_duplicate:
                duplicates_count += 1
            if category_id:
                categorized_count += 1

            preview_transactions.append(ImportPreviewTransaction(
                date=t.date.isoformat(),
                description=t.description,
                amount=t.amount,
                type=t.type,
                category_id=category_id,
                category_name=category_name,
                is_duplicate=is_duplicate,
                reference_hash=t.reference_hash
            ))

        response_data = {
            'transactions': preview_transactions,
            'total_count': len(preview_transactions),
            'duplicates_count': duplicates_count,
            'categorized_count': categorized_count
        }

        # Ajouter les détails de parsing si disponibles
        if parse_details:
            response_data.update({
                'total_lines': parse_details['total_lines'],
                'skipped_lines': parse_details['skipped_lines'],
                'skipped_reasons': parse_details['skipped_reasons'],
                'format_detected': parse_details['format_detected'],
                'sample_skipped': parse_details['sample_skipped']
            })

        return ImportPreviewResponse(**response_data)

    except BankParserError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du traitement du fichier: {str(e)}"
        )


@router.post("/import/confirm", response_model=BankImportResponse)
async def confirm_bank_import(
    data: ImportConfirmRequest,
    filename: str,
    file_type: str,
    account_type: str = "company",  # Type de compte: "company" ou "associate"
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Confirmer et importer les transactions après prévisualisation.
    """
    company_id = current_user.current_company_id or current_user.company_id

    # Valider le type de compte
    try:
        bank_account_type = BankAccountType(account_type)
    except ValueError:
        bank_account_type = BankAccountType.COMPANY

    # Vérifier que toutes les transactions NON-DOUBLONS ont une catégorie
    for t in data.transactions:
        # Ignorer les doublons (pas besoin de catégorie car ils seront ignorés)
        if t.get('is_duplicate') is True:
            continue
        if not t.get('category_id'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Toutes les transactions à importer doivent avoir une catégorie"
            )

    # Créer l'enregistrement d'import
    bank_import = BankImport(
        company_id=company_id,
        filename=filename,
        file_type=file_type,
        file_size=0,  # Pas de fichier sauvegardé
        status="processing",
        imported_by=current_user.id
    )
    db.add(bank_import)
    db.flush()

    # Récupérer les hash existants pour éviter les doublons
    existing_hashes = set(
        h[0] for h in db.query(Transaction.reference_hash).filter(
            Transaction.company_id == company_id,
            Transaction.reference_hash.isnot(None)
        ).all()
    )

    imported_count = 0
    skipped_count = 0

    for t in data.transactions:
        # Ignorer les doublons
        if t.get('reference_hash') in existing_hashes:
            skipped_count += 1
            continue

        # Ignorer si marqué comme doublon
        if t.get('is_duplicate'):
            skipped_count += 1
            continue

        # Créer la transaction
        transaction = Transaction(
            company_id=company_id,
            type=TransactionType(t['type']),
            amount=t['amount'],
            description=t['description'],
            transaction_date=datetime.fromisoformat(t['date']),
            category_id=t['category_id'],
            savings_category_id=t.get('savings_category_id'),  # Catégorie d'épargne (optionnel)
            auto_imported=True,
            bank_import_id=bank_import.id,
            reference_hash=t.get('reference_hash'),
            account_type=bank_account_type
        )

        db.add(transaction)
        imported_count += 1

        # Ajouter le hash aux existants pour éviter les doublons dans le même import
        if t.get('reference_hash'):
            existing_hashes.add(t['reference_hash'])

    # Mettre à jour le statut de l'import
    bank_import.status = "completed"
    bank_import.transactions_imported = imported_count
    bank_import.transactions_skipped = skipped_count
    bank_import.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(bank_import)

    return bank_import


@router.get("/imports", response_model=List[BankImportResponse])
async def get_import_history(
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer l'historique des imports bancaires"""
    company_id = current_user.current_company_id or current_user.company_id

    imports = db.query(BankImport).filter(
        BankImport.company_id == company_id
    ).order_by(BankImport.created_at.desc()).limit(limit).all()

    return imports
