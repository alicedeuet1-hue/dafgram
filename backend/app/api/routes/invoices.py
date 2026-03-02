"""Routes pour les factures"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import date, datetime

from app.db.database import get_db
from app.db.models import (
    User, Invoice, InvoiceLineItem, InvoicePayment,
    Client, Transaction, InvoiceStatus, Company, CompanySettings
)
from app.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceListResponse,
    InvoicePaymentCreate, InvoicePaymentResponse,
    LineItemCreate, LineItemUpdate, LineItemResponse
)
from app.core.security import get_current_active_user
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter(tags=["invoices"])


def generate_invoice_number(db: Session, company_id: int) -> str:
    """Générer un numéro de facture unique"""
    year = datetime.now().year

    # Compter les factures de cette année pour cette entreprise
    count = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        extract('year', Invoice.created_at) == year
    ).count()

    return f"FAC-{year}-{str(count + 1).zfill(3)}"


def calculate_invoice_totals(line_items: List, tax_rate: float):
    """Calculer les totaux d'une facture"""
    subtotal = sum(item.quantity * item.unit_price for item in line_items)
    tax_amount = subtotal * (tax_rate / 100)
    total_amount = subtotal + tax_amount
    return subtotal, tax_amount, total_amount


def update_invoice_status(invoice: Invoice, db: Session):
    """Mettre à jour le statut de la facture en fonction des paiements"""
    if invoice.status == InvoiceStatus.CANCELLED:
        return

    total_paid = sum(p.amount for p in invoice.payments)
    invoice.paid_amount = total_paid

    if total_paid >= invoice.total_amount:
        invoice.status = InvoiceStatus.PAID
    elif total_paid > 0:
        invoice.status = InvoiceStatus.PARTIALLY_PAID
    elif invoice.due_date < date.today() and invoice.status not in [InvoiceStatus.DRAFT, InvoiceStatus.PAID]:
        invoice.status = InvoiceStatus.OVERDUE

    db.commit()


@router.get("/", response_model=List[InvoiceListResponse])
async def get_invoices(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer toutes les factures"""
    company_id = current_user.current_company_id or current_user.company_id

    query = db.query(Invoice).filter(Invoice.company_id == company_id)

    if status:
        query = query.filter(Invoice.status == status)
    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    if start_date:
        query = query.filter(Invoice.issue_date >= start_date)
    if end_date:
        query = query.filter(Invoice.issue_date <= end_date)

    invoices = query.order_by(Invoice.created_at.desc()).all()

    result = []
    for inv in invoices:
        client_name = inv.client.name if inv.client else None
        result.append(InvoiceListResponse(
            id=inv.id,
            company_id=inv.company_id,
            invoice_number=inv.invoice_number,
            client_id=inv.client_id,
            client_name=client_name,
            issue_date=inv.issue_date,
            due_date=inv.due_date,
            status=inv.status.value,
            total_amount=inv.total_amount,
            paid_amount=inv.paid_amount,
            created_at=inv.created_at
        ))

    return result


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer une facture par ID"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    client_name = invoice.client.name if invoice.client else None
    client_email = invoice.client.email if invoice.client else None

    return InvoiceResponse(
        id=invoice.id,
        company_id=invoice.company_id,
        invoice_number=invoice.invoice_number,
        client_id=invoice.client_id,
        client_name=client_name,
        client_email=client_email,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        status=invoice.status.value,
        description=invoice.description,
        notes=invoice.notes,
        payment_terms=invoice.payment_terms,
        tax_rate=invoice.tax_rate,
        subtotal=invoice.subtotal,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        paid_amount=invoice.paid_amount,
        quote_id=invoice.quote_id,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        line_items=[LineItemResponse(
            id=item.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            amount=item.amount,
            position=item.position
        ) for item in sorted(invoice.line_items, key=lambda x: x.position)],
        payments=[InvoicePaymentResponse(
            id=p.id,
            invoice_id=p.invoice_id,
            transaction_id=p.transaction_id,
            amount=p.amount,
            payment_date=p.payment_date,
            payment_method=p.payment_method,
            notes=p.notes,
            created_at=p.created_at
        ) for p in invoice.payments]
    )


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Créer une nouvelle facture"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier que le client existe (si spécifié)
    if data.client_id:
        client = db.query(Client).filter(
            Client.id == data.client_id,
            Client.company_id == company_id
        ).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client non trouvé")

    # Générer le numéro de facture
    invoice_number = generate_invoice_number(db, company_id)

    # Créer la facture
    invoice = Invoice(
        company_id=company_id,
        client_id=data.client_id,
        invoice_number=invoice_number,
        issue_date=data.issue_date,
        due_date=data.due_date,
        status=InvoiceStatus.DRAFT,
        description=data.description,
        notes=data.notes,
        payment_terms=data.payment_terms,
        tax_rate=data.tax_rate
    )

    db.add(invoice)
    db.flush()  # Pour obtenir l'ID

    # Ajouter les lignes
    for idx, item_data in enumerate(data.line_items):
        line_item = InvoiceLineItem(
            invoice_id=invoice.id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            amount=item_data.quantity * item_data.unit_price,
            position=item_data.position or idx
        )
        db.add(line_item)

    # Calculer les totaux
    subtotal, tax_amount, total_amount = calculate_invoice_totals(data.line_items, data.tax_rate)
    invoice.subtotal = subtotal
    invoice.tax_amount = tax_amount
    invoice.total_amount = total_amount

    db.commit()
    db.refresh(invoice)

    return await get_invoice(invoice.id, db, current_user)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mettre à jour une facture"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    # Mettre à jour les champs
    update_data = data.model_dump(exclude_unset=True)

    if 'status' in update_data:
        update_data['status'] = InvoiceStatus(update_data['status'])

    for field, value in update_data.items():
        setattr(invoice, field, value)

    # Recalculer les totaux si le taux de TVA change
    if 'tax_rate' in update_data:
        subtotal, tax_amount, total_amount = calculate_invoice_totals(
            invoice.line_items, invoice.tax_rate
        )
        invoice.subtotal = subtotal
        invoice.tax_amount = tax_amount
        invoice.total_amount = total_amount

    db.commit()
    db.refresh(invoice)

    return await get_invoice(invoice.id, db, current_user)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer une facture"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    # Ne pas supprimer si des paiements sont associés
    if invoice.payments:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer une facture avec des paiements. Annulez-la plutôt."
        )

    db.delete(invoice)
    db.commit()

    return None


# ============ Line Items ============

@router.post("/{invoice_id}/items", response_model=LineItemResponse)
async def add_line_item(
    invoice_id: int,
    data: LineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Ajouter une ligne à la facture"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    line_item = InvoiceLineItem(
        invoice_id=invoice.id,
        description=data.description,
        quantity=data.quantity,
        unit_price=data.unit_price,
        amount=data.quantity * data.unit_price,
        position=data.position
    )

    db.add(line_item)

    # Recalculer les totaux
    invoice.line_items.append(line_item)
    subtotal, tax_amount, total_amount = calculate_invoice_totals(
        invoice.line_items, invoice.tax_rate
    )
    invoice.subtotal = subtotal
    invoice.tax_amount = tax_amount
    invoice.total_amount = total_amount

    db.commit()
    db.refresh(line_item)

    return LineItemResponse(
        id=line_item.id,
        description=line_item.description,
        quantity=line_item.quantity,
        unit_price=line_item.unit_price,
        amount=line_item.amount,
        position=line_item.position
    )


@router.delete("/{invoice_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_line_item(
    invoice_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer une ligne de la facture"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    line_item = db.query(InvoiceLineItem).filter(
        InvoiceLineItem.id == item_id,
        InvoiceLineItem.invoice_id == invoice_id
    ).first()

    if not line_item:
        raise HTTPException(status_code=404, detail="Ligne non trouvée")

    db.delete(line_item)

    # Recalculer les totaux
    remaining_items = [i for i in invoice.line_items if i.id != item_id]
    subtotal, tax_amount, total_amount = calculate_invoice_totals(
        remaining_items, invoice.tax_rate
    )
    invoice.subtotal = subtotal
    invoice.tax_amount = tax_amount
    invoice.total_amount = total_amount

    db.commit()

    return None


# ============ Payments ============

@router.get("/{invoice_id}/payments", response_model=List[InvoicePaymentResponse])
async def get_invoice_payments(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer les paiements d'une facture"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    return [InvoicePaymentResponse(
        id=p.id,
        invoice_id=p.invoice_id,
        transaction_id=p.transaction_id,
        amount=p.amount,
        payment_date=p.payment_date,
        payment_method=p.payment_method,
        notes=p.notes,
        created_at=p.created_at
    ) for p in invoice.payments]


@router.post("/{invoice_id}/payments", response_model=InvoicePaymentResponse, status_code=status.HTTP_201_CREATED)
async def add_payment(
    invoice_id: int,
    data: InvoicePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Ajouter un paiement à une facture (avec ou sans transaction bancaire)"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Impossible d'ajouter un paiement à une facture annulée")

    # Vérifier que la transaction existe et appartient à l'entreprise (si spécifiée)
    if data.transaction_id:
        transaction = db.query(Transaction).filter(
            Transaction.id == data.transaction_id,
            Transaction.company_id == company_id
        ).first()

        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction non trouvée")

        # Vérifier que la transaction n'est pas déjà associée à une autre facture
        existing_payment = db.query(InvoicePayment).filter(
            InvoicePayment.transaction_id == data.transaction_id
        ).first()

        if existing_payment:
            raise HTTPException(
                status_code=400,
                detail="Cette transaction est déjà associée à une facture"
            )

    # Créer le paiement
    payment = InvoicePayment(
        invoice_id=invoice.id,
        transaction_id=data.transaction_id,
        amount=data.amount,
        payment_date=data.payment_date,
        payment_method=data.payment_method,
        notes=data.notes
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Mettre à jour le statut de la facture
    update_invoice_status(invoice, db)

    return InvoicePaymentResponse(
        id=payment.id,
        invoice_id=payment.invoice_id,
        transaction_id=payment.transaction_id,
        amount=payment.amount,
        payment_date=payment.payment_date,
        payment_method=payment.payment_method,
        notes=payment.notes,
        created_at=payment.created_at
    )


@router.delete("/{invoice_id}/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    invoice_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Supprimer un paiement d'une facture"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    payment = db.query(InvoicePayment).filter(
        InvoicePayment.id == payment_id,
        InvoicePayment.invoice_id == invoice_id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Paiement non trouvé")

    db.delete(payment)
    db.commit()

    # Mettre à jour le statut de la facture
    update_invoice_status(invoice, db)

    return None


@router.post("/{invoice_id}/link-transaction/{transaction_id}", response_model=InvoicePaymentResponse, status_code=status.HTTP_201_CREATED)
async def link_transaction_to_invoice(
    invoice_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Associer une transaction bancaire à une facture (crée un paiement automatiquement)"""
    company_id = current_user.current_company_id or current_user.company_id

    # Vérifier la facture
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Impossible d'associer une transaction à une facture annulée")

    # Vérifier la transaction
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.company_id == company_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    if transaction.type.value != 'revenue':
        raise HTTPException(status_code=400, detail="Seules les transactions de type 'revenu' peuvent être associées à une facture")

    # Vérifier que la transaction n'est pas déjà associée
    existing_payment = db.query(InvoicePayment).filter(
        InvoicePayment.transaction_id == transaction_id
    ).first()

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Cette transaction est déjà associée à une facture"
        )

    # Calculer le montant restant à payer
    remaining_amount = invoice.total_amount - (invoice.paid_amount or 0)
    payment_amount = min(transaction.amount, remaining_amount)

    # Créer le paiement
    payment = InvoicePayment(
        invoice_id=invoice.id,
        transaction_id=transaction.id,
        amount=payment_amount,
        payment_date=transaction.transaction_date.date() if hasattr(transaction.transaction_date, 'date') else transaction.transaction_date,
        payment_method='virement',
        notes=f"Paiement lié à la transaction: {transaction.description[:100] if transaction.description else ''}"
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Mettre à jour le statut de la facture
    update_invoice_status(invoice, db)

    return InvoicePaymentResponse(
        id=payment.id,
        invoice_id=payment.invoice_id,
        transaction_id=payment.transaction_id,
        amount=payment.amount,
        payment_date=payment.payment_date,
        payment_method=payment.payment_method,
        notes=payment.notes,
        created_at=payment.created_at
    )


# ============ Unpaid Invoices (pour l'association rapide) ============

@router.get("/unpaid/list", response_model=List[InvoiceListResponse])
async def get_unpaid_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Récupérer les factures en attente de paiement"""
    company_id = current_user.current_company_id or current_user.company_id

    invoices = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.status.in_([
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE
        ])
    ).order_by(Invoice.due_date.asc()).all()

    result = []
    for inv in invoices:
        client_name = inv.client.name if inv.client else None
        result.append(InvoiceListResponse(
            id=inv.id,
            company_id=inv.company_id,
            invoice_number=inv.invoice_number,
            client_id=inv.client_id,
            client_name=client_name,
            issue_date=inv.issue_date,
            due_date=inv.due_date,
            status=inv.status.value,
            total_amount=inv.total_amount,
            paid_amount=inv.paid_amount,
            created_at=inv.created_at
        ))

    return result


# ============ PDF Generation ============

@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Télécharger la facture en PDF"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

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
            'default_invoice_terms': settings.default_invoice_terms,
            'default_invoice_notes': settings.default_invoice_notes,
            'default_payment_terms': settings.default_payment_terms,
            'bank_account': default_bank_account,
        }

    # Récupérer les données du client
    client_data = None
    if invoice.client:
        client_data = {
            'name': invoice.client.name,
            'first_name': invoice.client.first_name,
            'company_name': invoice.client.company_name,
            'email': invoice.client.email,
            'phone': invoice.client.phone,
            'address': invoice.client.address,
            'city': invoice.client.city,
            'postal_code': invoice.client.postal_code,
            'country': invoice.client.country,
        }

    # Préparer les données de la facture
    invoice_data = {
        'invoice_number': invoice.invoice_number,
        'issue_date': invoice.issue_date.strftime('%d/%m/%Y'),
        'due_date': invoice.due_date.strftime('%d/%m/%Y'),
        'status': invoice.status.value,
        'description': invoice.description,
        'notes': invoice.notes,
        'payment_terms': invoice.payment_terms,
        'subtotal': invoice.subtotal,
        'tax_amount': invoice.tax_amount,
        'total_amount': invoice.total_amount,
        'paid_amount': invoice.paid_amount or 0,
        'line_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'vat_rate': item.vat_rate if hasattr(item, 'vat_rate') and item.vat_rate else 0,
                'amount': item.amount,
            }
            for item in sorted(invoice.line_items, key=lambda x: x.position)
        ],
    }

    # Générer le PDF avec les couleurs personnalisées
    pdf_buffer = generate_invoice_pdf(
        invoice_data=invoice_data,
        company_data=company_data,
        client_data=client_data,
        currency=company.currency or 'EUR',
        settings=settings_data
    )

    filename = f"Facture_{invoice.invoice_number}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


# ============ Email Sending ============

from pydantic import BaseModel, EmailStr
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os


class SendInvoiceEmailRequest(BaseModel):
    to_email: EmailStr
    subject: Optional[str] = None
    message: Optional[str] = None


@router.post("/{invoice_id}/send-email")
async def send_invoice_email(
    invoice_id: int,
    data: SendInvoiceEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Envoyer la facture par email avec le PDF en pièce jointe"""
    company_id = current_user.current_company_id or current_user.company_id

    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.company_id == company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")

    # Récupérer l'entreprise
    company = db.query(Company).filter(Company.id == company_id).first()

    # Récupérer les paramètres de l'entreprise pour SMTP
    settings = db.query(CompanySettings).filter(
        CompanySettings.company_id == company_id
    ).first()

    # Configuration SMTP
    smtp_host = (settings.smtp_host if settings and settings.smtp_host else None) or os.getenv('SMTP_HOST', '')
    smtp_port = (settings.smtp_port if settings and settings.smtp_port else None) or int(os.getenv('SMTP_PORT', '587'))
    smtp_user = (settings.smtp_user if settings and settings.smtp_user else None) or os.getenv('SMTP_USER', '')
    smtp_password = (settings.smtp_password if settings and settings.smtp_password else None) or os.getenv('SMTP_PASSWORD', '')
    from_email = (settings.smtp_from_email if settings and settings.smtp_from_email else None) or os.getenv('SMTP_FROM_EMAIL', smtp_user)
    from_name = (settings.smtp_from_name if settings and settings.smtp_from_name else None) or company.name

    if not smtp_host or not smtp_user or not smtp_password:
        raise HTTPException(
            status_code=400,
            detail="Configuration SMTP manquante. Veuillez configurer les paramètres SMTP dans les paramètres de l'entreprise."
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

    settings_data = None
    if settings:
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
            'default_invoice_terms': settings.default_invoice_terms,
            'default_invoice_notes': settings.default_invoice_notes,
            'default_payment_terms': settings.default_payment_terms,
            'bank_account': default_bank_account,
        }

    client_data = None
    if invoice.client:
        client_data = {
            'name': invoice.client.name,
            'first_name': invoice.client.first_name,
            'company_name': invoice.client.company_name,
            'email': invoice.client.email,
            'phone': invoice.client.phone,
            'address': invoice.client.address,
            'city': invoice.client.city,
            'postal_code': invoice.client.postal_code,
            'country': invoice.client.country,
        }

    invoice_data = {
        'invoice_number': invoice.invoice_number,
        'issue_date': invoice.issue_date.strftime('%d/%m/%Y'),
        'due_date': invoice.due_date.strftime('%d/%m/%Y'),
        'status': invoice.status.value,
        'description': invoice.description,
        'notes': invoice.notes,
        'payment_terms': invoice.payment_terms,
        'subtotal': invoice.subtotal,
        'tax_amount': invoice.tax_amount,
        'total_amount': invoice.total_amount,
        'paid_amount': invoice.paid_amount or 0,
        'line_items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'vat_rate': item.vat_rate if hasattr(item, 'vat_rate') and item.vat_rate else 0,
                'amount': item.amount,
            }
            for item in sorted(invoice.line_items, key=lambda x: x.position)
        ],
    }

    # Générer le PDF
    pdf_buffer = generate_invoice_pdf(
        invoice_data=invoice_data,
        company_data=company_data,
        client_data=client_data,
        currency=company.currency or 'EUR',
        settings=settings_data
    )

    # Créer l'email
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = data.to_email
    msg['Subject'] = data.subject or f"Facture {invoice.invoice_number} - {company.name}"

    # Corps du message - utiliser le template personnalisé si disponible
    custom_template = settings.default_invoice_email_message if settings and settings.default_invoice_email_message else None

    if custom_template:
        # Remplacer les variables du template personnalisé
        client_name = ""
        if invoice.client:
            client_name = invoice.client.company_name or f"{invoice.client.first_name or ''} {invoice.client.name or ''}".strip()

        default_message = custom_template.replace('{numero_facture}', invoice.invoice_number)
        default_message = default_message.replace('{montant}', f"{invoice.total_amount:.2f}")
        default_message = default_message.replace('{devise}', company.currency or 'EUR')
        default_message = default_message.replace('{date_echeance}', invoice.due_date.strftime('%d/%m/%Y'))
        default_message = default_message.replace('{nom_entreprise}', company.name)
        default_message = default_message.replace('{nom_client}', client_name)
    else:
        # Message par défaut si aucun template personnalisé
        default_message = f"""Bonjour,

Veuillez trouver ci-joint la facture {invoice.invoice_number} d'un montant de {invoice.total_amount:.2f} {company.currency or 'EUR'}.

Cette facture est à régler avant le {invoice.due_date.strftime('%d/%m/%Y')}.

N'hésitez pas à nous contacter pour toute question.

Cordialement,
{company.name}
"""
    body = data.message or default_message
    msg.attach(MIMEText(body, 'plain', 'utf-8'))

    # Joindre le PDF
    pdf_attachment = MIMEApplication(pdf_buffer.read(), _subtype='pdf')
    pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"Facture_{invoice.invoice_number}.pdf")
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

        # Mettre à jour le statut de la facture en "envoyé" si c'était un brouillon
        if invoice.status == InvoiceStatus.DRAFT:
            invoice.status = InvoiceStatus.SENT
            db.commit()

        return {"message": "Email envoyé avec succès", "to": data.to_email}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'envoi de l'email: {str(e)}"
        )
