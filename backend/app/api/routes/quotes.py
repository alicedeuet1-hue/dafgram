"""Routes pour les devis"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, EmailStr
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os

from app.db.database import get_db
from app.db.models import (
    User, Quote, QuoteLineItem, Invoice, InvoiceLineItem,
    Client, QuoteStatus, InvoiceStatus, Company, CompanySettings
)
from app.schemas.invoice import (
    QuoteCreate, QuoteUpdate, QuoteResponse, QuoteListResponse,
    QuoteLineItemResponse, LineItemCreate,
    QuoteToInvoiceRequest, InvoiceResponse
)
from app.core.security import get_current_active_user
from app.services.pdf_service import generate_quote_pdf

router = APIRouter(tags=["quotes"])


def generate_quote_number(db: Session, company_id: int) -> str:
    """Générer un numéro de devis unique"""
    year = datetime.now().year

    # Compter les devis de cette année pour cette entreprise
    count = db.query(Quote).filter(
        Quote.company_id == company_id,
        extract('year', Quote.created_at) == year
    ).count()

    return f"DEV-{year}-{str(count + 1).zfill(3)}"


def generate_invoice_number(db: Session, company_id: int) -> str:
    """Générer un numéro de facture unique"""
    year = datetime.now().year

    count = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        extract('year', Invoice.created_at) == year
    ).count()

    return f"FAC-{year}-{str(count + 1).zfill(3)}"


def calculate_totals(line_items: List, default_tax_rate: float = 0.0):
    """Calculer les totaux avec TVA par ligne"""
    subtotal = 0.0
    total_vat = 0.0

    for item in line_items:
        # Montant HT de la ligne
        line_amount = item.quantity * item.unit_price
        subtotal += line_amount

        # TVA de la ligne (utilise le taux de la ligne ou le taux par défaut)
        line_vat_rate = getattr(item, 'vat_rate', None)
        if line_vat_rate is None:
            line_vat_rate = default_tax_rate
        line_vat = line_amount * (line_vat_rate / 100)
        total_vat += line_vat

    total_amount = subtotal + total_vat
    return subtotal, total_vat, total_amount


@router.get("/", response_model=List[QuoteListResponse])
async def get_quotes(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer tous les devis"""
    company_id = current_user.current_company_id or current_user.company_id

    # Auto-expiration des devis dont la date de validité est passée
    today = date.today()
    expired_quotes = db.query(Quote).filter(
        Quote.company_id == company_id,
        Quote.valid_until < today,
        Quote.status.in_([QuoteStatus.DRAFT, QuoteStatus.SENT])
    ).all()

    if expired_quotes:
        for q in expired_quotes:
            q.status = QuoteStatus.EXPIRED
        db.commit()

    query = db.query(Quote).filter(Quote.company_id == company_id)

    if status:
        query = query.filter(Quote.status == status)
    if client_id:
        query = query.filter(Quote.client_id == client_id)
    if start_date:
        query = query.filter(Quote.issue_date >= start_date)
    if end_date:
        query = query.filter(Quote.issue_date <= end_date)

    quotes = query.order_by(Quote.created_at.desc()).all()

    result = []
    for quote in quotes:
        client_name = quote.client.name if quote.client else None
        result.append(QuoteListResponse(
            id=quote.id,
            company_id=quote.company_id,
            quote_number=quote.quote_number,
            client_id=quote.client_id,
            client_name=client_name,
            issue_date=quote.issue_date,
            valid_until=quote.valid_until,
            status=quote.status.value,
            total_amount=quote.total_amount,
            created_at=quote.created_at
        ))

    return result


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer un devis par ID"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    # Auto-expiration si la date de validité est passée
    today = date.today()
    if quote.valid_until < today and quote.status in [QuoteStatus.DRAFT, QuoteStatus.SENT]:
        quote.status = QuoteStatus.EXPIRED
        db.commit()
        db.refresh(quote)

    client_name = quote.client.name if quote.client else None

    return QuoteResponse(
        id=quote.id,
        company_id=quote.company_id,
        quote_number=quote.quote_number,
        client_id=quote.client_id,
        client_name=client_name,
        issue_date=quote.issue_date,
        valid_until=quote.valid_until,
        status=quote.status.value,
        description=quote.description,
        notes=quote.notes,
        terms=quote.terms,
        tax_rate=quote.tax_rate,
        subtotal=quote.subtotal,
        tax_amount=quote.tax_amount,
        total_amount=quote.total_amount,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
        line_items=[QuoteLineItemResponse(
            id=item.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            vat_rate=item.vat_rate or 0,
            amount=item.amount,
            vat_amount=item.vat_amount or 0,
            amount_with_vat=item.amount_with_vat or item.amount,
            position=item.position
        ) for item in sorted(quote.line_items, key=lambda x: x.position)]
    )


@router.post("/", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    data: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer un nouveau devis"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le client existe (si spécifié)
    if data.client_id:
        client = db.query(Client).filter(
            Client.id == data.client_id,
            Client.company_id == company_id
        ).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client non trouvé")

    # Générer le numéro de devis
    quote_number = generate_quote_number(db, company_id)

    # Créer le devis
    quote = Quote(
        company_id=company_id,
        client_id=data.client_id,
        quote_number=quote_number,
        issue_date=data.issue_date,
        valid_until=data.valid_until,
        status=QuoteStatus.DRAFT,
        description=data.description,
        notes=data.notes,
        terms=data.terms,
        tax_rate=data.tax_rate
    )

    db.add(quote)
    db.flush()

    # Ajouter les lignes avec TVA par ligne
    for idx, item_data in enumerate(data.line_items):
        line_amount = item_data.quantity * item_data.unit_price
        line_vat_rate = item_data.vat_rate if item_data.vat_rate is not None else data.tax_rate
        line_vat_amount = line_amount * (line_vat_rate / 100)
        line_amount_with_vat = line_amount + line_vat_amount

        line_item = QuoteLineItem(
            quote_id=quote.id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            amount=line_amount,
            vat_rate=line_vat_rate,
            vat_amount=line_vat_amount,
            amount_with_vat=line_amount_with_vat,
            position=item_data.position or idx
        )
        db.add(line_item)

    # Calculer les totaux
    subtotal, tax_amount, total_amount = calculate_totals(data.line_items, data.tax_rate)
    quote.subtotal = subtotal
    quote.tax_amount = tax_amount
    quote.total_amount = total_amount

    db.commit()
    db.refresh(quote)

    return await get_quote(quote.id, db, current_user)


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: int,
    data: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour un devis"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    # Mettre à jour les champs
    update_data = data.model_dump(exclude_unset=True)

    if 'status' in update_data:
        update_data['status'] = QuoteStatus(update_data['status'])

    for field, value in update_data.items():
        setattr(quote, field, value)

    # Recalculer les totaux si le taux de TVA change
    if 'tax_rate' in update_data:
        subtotal, tax_amount, total_amount = calculate_totals(
            quote.line_items, quote.tax_rate
        )
        quote.subtotal = subtotal
        quote.tax_amount = tax_amount
        quote.total_amount = total_amount

    db.commit()
    db.refresh(quote)

    return await get_quote(quote.id, db, current_user)


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer un devis"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    # Ne pas supprimer si une facture a été créée
    if quote.invoice:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer un devis converti en facture"
        )

    db.delete(quote)
    db.commit()

    return None


# ============ Line Items ============

@router.post("/{quote_id}/items", response_model=QuoteLineItemResponse)
async def add_line_item(
    quote_id: int,
    data: LineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Ajouter une ligne au devis"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    line_amount = data.quantity * data.unit_price
    line_vat_rate = data.vat_rate if data.vat_rate is not None else quote.tax_rate
    line_vat_amount = line_amount * (line_vat_rate / 100)
    line_amount_with_vat = line_amount + line_vat_amount

    line_item = QuoteLineItem(
        quote_id=quote.id,
        description=data.description,
        quantity=data.quantity,
        unit_price=data.unit_price,
        amount=line_amount,
        vat_rate=line_vat_rate,
        vat_amount=line_vat_amount,
        amount_with_vat=line_amount_with_vat,
        position=data.position
    )

    db.add(line_item)

    # Recalculer les totaux
    quote.line_items.append(line_item)
    subtotal, tax_amount, total_amount = calculate_totals(
        quote.line_items, quote.tax_rate
    )
    quote.subtotal = subtotal
    quote.tax_amount = tax_amount
    quote.total_amount = total_amount

    db.commit()
    db.refresh(line_item)

    return QuoteLineItemResponse(
        id=line_item.id,
        description=line_item.description,
        quantity=line_item.quantity,
        unit_price=line_item.unit_price,
        amount=line_item.amount,
        position=line_item.position
    )


@router.delete("/{quote_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_line_item(
    quote_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer une ligne du devis"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    line_item = db.query(QuoteLineItem).filter(
        QuoteLineItem.id == item_id,
        QuoteLineItem.quote_id == quote_id
    ).first()

    if not line_item:
        raise HTTPException(status_code=404, detail="Ligne non trouvée")

    db.delete(line_item)

    # Recalculer les totaux
    remaining_items = [i for i in quote.line_items if i.id != item_id]
    subtotal, tax_amount, total_amount = calculate_totals(
        remaining_items, quote.tax_rate
    )
    quote.subtotal = subtotal
    quote.tax_amount = tax_amount
    quote.total_amount = total_amount

    db.commit()

    return None


# ============ Convert to Invoice ============

@router.post("/{quote_id}/convert-to-invoice", response_model=InvoiceResponse)
async def convert_to_invoice(
    quote_id: int,
    data: QuoteToInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Convertir un devis accepté en facture"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    if quote.status != QuoteStatus.ACCEPTED:
        raise HTTPException(
            status_code=400,
            detail="Seul un devis accepté peut être converti en facture"
        )

    if quote.invoice:
        raise HTTPException(
            status_code=400,
            detail="Ce devis a déjà été converti en facture"
        )

    # Générer le numéro de facture
    invoice_number = generate_invoice_number(db, company_id)

    # Créer la facture
    invoice = Invoice(
        company_id=company_id,
        client_id=quote.client_id,
        quote_id=quote.id,
        invoice_number=invoice_number,
        issue_date=date.today(),
        due_date=data.due_date,
        status=InvoiceStatus.DRAFT,
        description=quote.description,
        notes=quote.notes,
        payment_terms=data.payment_terms,
        tax_rate=quote.tax_rate,
        subtotal=quote.subtotal,
        tax_amount=quote.tax_amount,
        total_amount=quote.total_amount
    )

    db.add(invoice)
    db.flush()

    # Copier les lignes du devis
    for item in quote.line_items:
        invoice_item = InvoiceLineItem(
            invoice_id=invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            amount=item.amount,
            position=item.position
        )
        db.add(invoice_item)

    db.commit()
    db.refresh(invoice)

    # Importer la fonction get_invoice depuis invoices.py
    from app.api.routes.invoices import get_invoice
    return await get_invoice(invoice.id, db, current_user)


# ============ PDF Generation ============

@router.get("/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Télécharger le devis en PDF"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    # Récupérer les données de l'entreprise
    company = db.query(Company).filter(Company.id == company_id).first()
    company_data = {
        'name': company.name,
        'email': company.email,
        'phone': company.phone,
        'address': company.address,
        'city': company.city,
        'postal_code': company.postal_code,
        'country': company.country,
        'vat_number': company.vat_number,
    }

    # Récupérer les paramètres de l'entreprise (couleurs, etc.)
    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()
    settings_data = None
    if settings:
        # Récupérer le compte bancaire par défaut
        default_bank_account = None
        for ba in settings.bank_accounts:
            if ba.is_default:
                default_bank_account = {
                    'label': ba.label,
                    'bank_name': ba.bank_name,
                    'account_holder': ba.account_holder,
                    'iban': ba.iban,
                    'bic': ba.bic,
                }
                break

        settings_data = {
            'primary_color': settings.primary_color or '#F5C518',
            'secondary_color': settings.secondary_color or '#1A1A1A',
            'text_color': settings.text_color or '#FFFFFF',
            'logo_url': settings.logo_url,
            'document_footer': settings.document_footer,
            'default_quote_terms': settings.default_quote_terms,
            'default_quote_notes': settings.default_quote_notes,
            'default_payment_terms': settings.default_payment_terms,
            'bank_account': default_bank_account,
        }

    # Récupérer les données du client
    client_data = None
    if quote.client:
        client_data = {
            'name': quote.client.name,
            'first_name': quote.client.first_name,
            'company_name': quote.client.company_name,
            'email': quote.client.email,
            'phone': quote.client.phone,
            'address': quote.client.address,
            'city': quote.client.city,
            'postal_code': quote.client.postal_code,
            'country': quote.client.country,
        }

    # Préparer les données du devis
    quote_data = {
        'quote_number': quote.quote_number,
        'issue_date': quote.issue_date.strftime('%d/%m/%Y'),
        'valid_until': quote.valid_until.strftime('%d/%m/%Y'),
        'status': quote.status.value,
        'description': quote.description,
        'notes': quote.notes,
        'terms': quote.terms,
        'subtotal': quote.subtotal,
        'tax_amount': quote.tax_amount,
        'total_amount': quote.total_amount,
        'line_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'vat_rate': item.vat_rate or 0,
                'amount': item.amount,
                'vat_amount': item.vat_amount or 0,
                'amount_with_vat': item.amount_with_vat or item.amount,
            }
            for item in sorted(quote.line_items, key=lambda x: x.position)
        ],
    }

    # Générer le PDF avec les couleurs personnalisées
    pdf_buffer = generate_quote_pdf(
        quote_data=quote_data,
        company_data=company_data,
        client_data=client_data,
        currency=company.currency or 'EUR',
        settings=settings_data
    )

    filename = f"Devis_{quote.quote_number}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


# ============ Email Sending ============

class SendQuoteEmailRequest(BaseModel):
    to_email: EmailStr
    subject: Optional[str] = None
    message: Optional[str] = None


@router.post("/{quote_id}/send-email")
async def send_quote_email(
    quote_id: int,
    data: SendQuoteEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Envoyer le devis par email avec le PDF en pièce jointe"""
    company_id = current_user.current_company_id or current_user.company_id

    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.company_id == company_id
    ).first()

    if not quote:
        raise HTTPException(status_code=404, detail="Devis non trouvé")

    # Récupérer l'entreprise
    company = db.query(Company).filter(Company.id == company_id).first()

    # Récupérer les paramètres de l'entreprise pour SMTP
    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    # Configuration SMTP depuis les paramètres de l'entreprise (prioritaire) ou variables d'environnement (fallback)
    smtp_host = (settings.smtp_host if settings and settings.smtp_host else None) or os.getenv('SMTP_HOST', '')
    smtp_port = (settings.smtp_port if settings and settings.smtp_port else None) or int(os.getenv('SMTP_PORT', '587'))
    smtp_user = (settings.smtp_user if settings and settings.smtp_user else None) or os.getenv('SMTP_USER', '')
    smtp_password = (settings.smtp_password if settings and settings.smtp_password else None) or os.getenv('SMTP_PASSWORD', '')
    from_email = (settings.smtp_from_email if settings and settings.smtp_from_email else None) or os.getenv('SMTP_FROM_EMAIL', smtp_user)
    from_name = (settings.smtp_from_name if settings and settings.smtp_from_name else None) or company.name

    if not smtp_host or not smtp_user or not smtp_password:
        raise HTTPException(
            status_code=400,
            detail="Configuration SMTP manquante. Veuillez configurer les paramètres SMTP dans les paramètres de l'entreprise (Comptabilité > Paramètres > Email)."
        )

    # Préparer les données pour le PDF
    company_data = {
        'name': company.name,
        'email': company.email,
        'phone': company.phone,
        'address': company.address,
        'city': company.city,
        'postal_code': company.postal_code,
        'country': company.country,
        'vat_number': company.vat_number,
    }

    # Préparer les settings_data pour le PDF (settings déjà récupéré pour SMTP)
    settings_data = None
    if settings:
        # Récupérer le compte bancaire par défaut
        default_bank_account = None
        for ba in settings.bank_accounts:
            if ba.is_default:
                default_bank_account = {
                    'label': ba.label,
                    'bank_name': ba.bank_name,
                    'account_holder': ba.account_holder,
                    'iban': ba.iban,
                    'bic': ba.bic,
                }
                break

        settings_data = {
            'primary_color': settings.primary_color or '#F5C518',
            'secondary_color': settings.secondary_color or '#1A1A1A',
            'text_color': settings.text_color or '#FFFFFF',
            'logo_url': settings.logo_url,
            'document_footer': settings.document_footer,
            'default_quote_terms': settings.default_quote_terms,
            'default_quote_notes': settings.default_quote_notes,
            'default_payment_terms': settings.default_payment_terms,
            'bank_account': default_bank_account,
        }

    client_data = None
    if quote.client:
        client_data = {
            'name': quote.client.name,
            'first_name': quote.client.first_name,
            'company_name': quote.client.company_name,
            'email': quote.client.email,
            'phone': quote.client.phone,
            'address': quote.client.address,
            'city': quote.client.city,
            'postal_code': quote.client.postal_code,
            'country': quote.client.country,
        }

    quote_data = {
        'quote_number': quote.quote_number,
        'issue_date': quote.issue_date.strftime('%d/%m/%Y'),
        'valid_until': quote.valid_until.strftime('%d/%m/%Y'),
        'status': quote.status.value,
        'description': quote.description,
        'notes': quote.notes,
        'terms': quote.terms,
        'subtotal': quote.subtotal,
        'tax_amount': quote.tax_amount,
        'total_amount': quote.total_amount,
        'line_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'vat_rate': item.vat_rate or 0,
                'amount': item.amount,
                'vat_amount': item.vat_amount or 0,
                'amount_with_vat': item.amount_with_vat or item.amount,
            }
            for item in sorted(quote.line_items, key=lambda x: x.position)
        ],
    }

    # Générer le PDF avec les couleurs personnalisées
    pdf_buffer = generate_quote_pdf(
        quote_data=quote_data,
        company_data=company_data,
        client_data=client_data,
        currency=company.currency or 'EUR',
        settings=settings_data
    )

    # Créer l'email
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = data.to_email
    msg['Subject'] = data.subject or f"Devis {quote.quote_number} - {company.name}"

    # Corps du message - utiliser le template personnalisé si disponible
    custom_template = settings.default_quote_email_message if settings and settings.default_quote_email_message else None

    if custom_template:
        # Remplacer les variables du template personnalisé
        client_name = ""
        if quote.client:
            client_name = quote.client.company_name or f"{quote.client.first_name or ''} {quote.client.name or ''}".strip()

        default_message = custom_template.replace('{numero_devis}', quote.quote_number)
        default_message = default_message.replace('{montant}', f"{quote.total_amount:.2f}")
        default_message = default_message.replace('{devise}', company.currency or 'EUR')
        default_message = default_message.replace('{date_validite}', quote.valid_until.strftime('%d/%m/%Y'))
        default_message = default_message.replace('{nom_entreprise}', company.name)
        default_message = default_message.replace('{nom_client}', client_name)
    else:
        # Message par défaut si aucun template personnalisé
        default_message = f"""Bonjour,

Veuillez trouver ci-joint le devis {quote.quote_number} d'un montant de {quote.total_amount:.2f} {company.currency or 'EUR'}.

Ce devis est valable jusqu'au {quote.valid_until.strftime('%d/%m/%Y')}.

N'hésitez pas à nous contacter pour toute question.

Cordialement,
{company.name}
"""
    body = data.message or default_message
    msg.attach(MIMEText(body, 'plain', 'utf-8'))

    # Joindre le PDF
    pdf_attachment = MIMEApplication(pdf_buffer.read(), _subtype='pdf')
    pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"Devis_{quote.quote_number}.pdf")
    msg.attach(pdf_attachment)

    # Envoyer l'email
    try:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            start_tls=True,
        )

        # Mettre à jour le statut du devis en "envoyé" si c'était un brouillon
        if quote.status == QuoteStatus.DRAFT:
            quote.status = QuoteStatus.SENT
            db.commit()

        return {"message": "Email envoyé avec succès", "to": data.to_email}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'envoi de l'email: {str(e)}"
        )
