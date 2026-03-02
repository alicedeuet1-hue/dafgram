"""Service de génération PDF pour devis et factures"""
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, KeepTogether, PageBreak
)
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from datetime import datetime
from typing import Optional
import os


def format_currency(amount: float, currency: str = "EUR") -> str:
    """Formater un montant avec devise"""
    symbols = {
        "EUR": "€",
        "USD": "$",
        "GBP": "£",
        "XPF": "XPF",
        "CHF": "CHF",
    }
    symbol = symbols.get(currency, currency)

    # Format français: 1 234,56 €
    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")

    if currency in ["EUR", "XPF", "CHF"]:
        return f"{formatted} {symbol}"
    return f"{symbol}{formatted}"


def generate_quote_pdf(
    quote_data: dict,
    company_data: dict,
    client_data: Optional[dict] = None,
    currency: str = "EUR",
    settings: Optional[dict] = None
) -> BytesIO:
    """
    Générer un PDF pour un devis

    Args:
        quote_data: Données du devis
        company_data: Données de l'entreprise
        client_data: Données du client (optionnel)
        currency: Devise
        settings: Paramètres de personnalisation (couleurs, etc.)

    Returns:
        BytesIO contenant le PDF
    """
    # Couleurs par défaut ou personnalisées
    primary_color = settings.get('primary_color', '#F5C518') if settings else '#F5C518'
    secondary_color = settings.get('secondary_color', '#1A1A1A') if settings else '#1A1A1A'
    text_color = settings.get('text_color', '#FFFFFF') if settings else '#FFFFFF'
    document_footer = settings.get('document_footer') if settings else None

    buffer = BytesIO()

    # Fonction pour dessiner le footer sur chaque page
    def add_page_footer(canvas, doc):
        if document_footer:
            canvas.saveState()
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.HexColor('#6B7280'))
            # Centrer le texte en bas de page
            page_width = A4[0]
            text_width = canvas.stringWidth(document_footer, 'Helvetica', 8)
            x = (page_width - text_width) / 2
            canvas.drawString(x, 1.2*cm, document_footer)
            canvas.restoreState()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2.5*cm if document_footer else 2*cm
    )

    # Styles avec couleurs personnalisées
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='QuoteTitle',
        fontSize=24,
        spaceAfter=20,
        textColor=colors.HexColor(secondary_color),
        fontName='Helvetica-Bold',
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='QuoteSubtitle',
        fontSize=12,
        spaceAfter=6,
        textColor=colors.HexColor('#6B7280'),
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='QuoteInfoRight',
        fontSize=10,
        textColor=colors.HexColor('#4B5563'),
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='CompanyName',
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor(secondary_color),
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle',
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor(primary_color),
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name='QuoteNormal',
        fontSize=10,
        textColor=colors.HexColor('#4B5563'),
    ))
    styles.add(ParagraphStyle(
        name='RightAlign',
        fontSize=10,
        alignment=TA_RIGHT,
        textColor=colors.HexColor('#4B5563'),
    ))
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor(text_color),
    ))

    elements = []

    # === EN-TÊTE: Logo à gauche, Infos devis à droite ===
    # Préparer le logo
    logo_element = None
    logo_url = settings.get('logo_url') if settings else None
    if logo_url:
        logo_path = f"/app{logo_url}" if logo_url.startswith('/uploads') else logo_url
        if os.path.exists(logo_path):
            try:
                logo_element = Image(logo_path, width=3*cm, height=3*cm)
            except Exception:
                pass

    # Préparer les infos du devis (colonne droite)
    quote_info_content = []
    quote_info_content.append(Paragraph('DEVIS', styles['QuoteTitle']))
    quote_info_content.append(Paragraph(f"N° {quote_data.get('quote_number', '')}", styles['QuoteSubtitle']))
    quote_info_content.append(Paragraph(f"Date: {quote_data.get('issue_date', '')}", styles['QuoteInfoRight']))
    quote_info_content.append(Paragraph(f"Valide jusqu'au: {quote_data.get('valid_until', '')}", styles['QuoteInfoRight']))

    # Créer le tableau d'en-tête avec logo et infos devis
    if logo_element:
        header_table = Table([
            [logo_element, quote_info_content]
        ], colWidths=[10*cm, 7*cm])
    else:
        header_table = Table([
            ['', quote_info_content]
        ], colWidths=[10*cm, 7*cm])

    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.8*cm))

    # === INFOS ENTREPRISE ===
    company_info = []
    company_info.append(Paragraph(company_data.get('name', ''), styles['CompanyName']))
    if company_data.get('address'):
        company_info.append(Paragraph(company_data['address'], styles['QuoteNormal']))
    city_line = []
    if company_data.get('postal_code'):
        city_line.append(company_data['postal_code'])
    if company_data.get('city'):
        city_line.append(company_data['city'])
    if city_line:
        company_info.append(Paragraph(' '.join(city_line), styles['QuoteNormal']))
    if company_data.get('country'):
        company_info.append(Paragraph(company_data['country'], styles['QuoteNormal']))
    if company_data.get('email'):
        company_info.append(Paragraph(company_data['email'], styles['QuoteNormal']))
    if company_data.get('phone'):
        company_info.append(Paragraph(company_data['phone'], styles['QuoteNormal']))
    if company_data.get('vat_number'):
        company_info.append(Paragraph(f"TVA: {company_data['vat_number']}", styles['QuoteNormal']))

    for item in company_info:
        elements.append(item)
    elements.append(Spacer(1, 0.8*cm))

    # === INFORMATIONS CLIENT ===
    if client_data:
        elements.append(Paragraph('DESTINATAIRE', styles['SectionTitle']))
        client_name = client_data.get('company_name') or f"{client_data.get('first_name', '')} {client_data.get('name', '')}".strip()
        elements.append(Paragraph(f"<b>{client_name}</b>", styles['QuoteNormal']))
        if client_data.get('address'):
            elements.append(Paragraph(client_data['address'], styles['QuoteNormal']))
        client_city = []
        if client_data.get('postal_code'):
            client_city.append(client_data['postal_code'])
        if client_data.get('city'):
            client_city.append(client_data['city'])
        if client_city:
            elements.append(Paragraph(' '.join(client_city), styles['QuoteNormal']))
        if client_data.get('email'):
            elements.append(Paragraph(client_data['email'], styles['QuoteNormal']))
        elements.append(Spacer(1, 0.5*cm))

    # === DESCRIPTION / OBJET ===
    if quote_data.get('description'):
        elements.append(Paragraph('OBJET', styles['SectionTitle']))
        elements.append(Paragraph(quote_data['description'], styles['QuoteNormal']))
        elements.append(Spacer(1, 0.5*cm))

    # === TABLEAU DES LIGNES ===
    elements.append(Paragraph('DÉTAIL', styles['SectionTitle']))

    table_data = [
        [
            Paragraph('Description', styles['TableHeader']),
            Paragraph('Qté', styles['TableHeader']),
            Paragraph('Prix HT', styles['TableHeader']),
            Paragraph('TVA', styles['TableHeader']),
            Paragraph('Total TTC', styles['TableHeader']),
        ]
    ]

    for item in quote_data.get('line_items', []):
        vat_rate = item.get('vat_rate', 0)
        unit_price = item.get('unit_price', 0)
        quantity = item.get('quantity', 1)
        amount_ht = quantity * unit_price
        vat_amount = amount_ht * (vat_rate / 100)
        amount_ttc = amount_ht + vat_amount

        table_data.append([
            Paragraph(item.get('description', ''), styles['QuoteNormal']),
            Paragraph(str(quantity), styles['QuoteNormal']),
            Paragraph(format_currency(unit_price, currency), styles['RightAlign']),
            Paragraph(f"{vat_rate}%", styles['QuoteNormal']),
            Paragraph(format_currency(amount_ttc, currency), styles['RightAlign']),
        ])

    col_widths = [7*cm, 1.5*cm, 3*cm, 1.5*cm, 3.5*cm]
    line_table = Table(table_data, colWidths=col_widths)
    line_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(primary_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor(text_color)),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#4B5563')),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#E5E7EB')),
        ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#E5E7EB')),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (3, -1), 'CENTER'),
        ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.5*cm))

    # === TOTAUX ===
    subtotal = quote_data.get('subtotal', 0)
    tax_amount = quote_data.get('tax_amount', 0)
    total = quote_data.get('total_amount', 0)

    totals_col_widths = [10*cm, 3.5*cm, 3*cm]
    totals_data = [
        ['', Paragraph('Sous-total HT:', styles['RightAlign']), Paragraph(f"<b>{format_currency(subtotal, currency)}</b>", styles['RightAlign'])],
        ['', Paragraph('TVA:', styles['RightAlign']), Paragraph(f"<b>{format_currency(tax_amount, currency)}</b>", styles['RightAlign'])],
        ['', Paragraph('<b>TOTAL TTC:</b>', styles['RightAlign']), Paragraph(f"<b><font color='{primary_color}'>{format_currency(total, currency)}</font></b>", styles['RightAlign'])],
    ]

    totals_table = Table(totals_data, colWidths=totals_col_widths)
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEABOVE', (1, 2), (2, 2), 1, colors.HexColor(secondary_color)),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 1*cm))

    # === NOTES, CONDITIONS, RIB, SIGNATURE - en blocs non séparables ===
    notes = quote_data.get('notes') or (settings.get('default_quote_notes') if settings else None)
    terms = quote_data.get('terms') or (settings.get('default_quote_terms') if settings else None)
    payment_terms = settings.get('default_payment_terms') if settings else None
    bank_account = settings.get('bank_account') if settings else None

    # Notes (bloc)
    if notes:
        notes_block = [
            Paragraph('NOTES', styles['SectionTitle']),
            Paragraph(notes, styles['QuoteNormal']),
            Spacer(1, 0.5*cm)
        ]
        elements.append(KeepTogether(notes_block))

    # Conditions (bloc)
    if terms:
        terms_block = [
            Paragraph('CONDITIONS', styles['SectionTitle']),
            Paragraph(terms, styles['QuoteNormal']),
            Spacer(1, 0.5*cm)
        ]
        elements.append(KeepTogether(terms_block))

    # Conditions de paiement (bloc)
    if payment_terms:
        payment_block = [
            Paragraph('CONDITIONS DE PAIEMENT', styles['SectionTitle']),
            Paragraph(payment_terms, styles['QuoteNormal']),
            Spacer(1, 0.5*cm)
        ]
        elements.append(KeepTogether(payment_block))

    # Informations bancaires (bloc)
    if bank_account:
        bank_block = [Paragraph('COORDONNÉES BANCAIRES', styles['SectionTitle'])]
        bank_info = []
        if bank_account.get('bank_name'):
            bank_info.append(f"<b>Banque:</b> {bank_account['bank_name']}")
        if bank_account.get('account_holder'):
            bank_info.append(f"<b>Titulaire:</b> {bank_account['account_holder']}")
        if bank_account.get('iban'):
            bank_info.append(f"<b>IBAN:</b> {bank_account['iban']}")
        if bank_account.get('bic'):
            bank_info.append(f"<b>BIC:</b> {bank_account['bic']}")
        if bank_info:
            bank_block.append(Paragraph('<br/>'.join(bank_info), styles['QuoteNormal']))
            bank_block.append(Spacer(1, 0.5*cm))
        elements.append(KeepTogether(bank_block))

    # Signature (bloc)
    signature_block = [
        Spacer(1, 0.5*cm),
        Table([
            [
                Paragraph('Signature du client<br/>(précédée de "Bon pour accord")', styles['QuoteNormal']),
                Paragraph(f"Fait à _____________, le _____________", styles['QuoteNormal']),
            ]
        ], colWidths=[8.5*cm, 8.5*cm]),
    ]
    signature_block[1].setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 20),
    ]))
    elements.append(KeepTogether(signature_block))

    # Construire le PDF avec le footer sur chaque page
    doc.build(elements, onFirstPage=add_page_footer, onLaterPages=add_page_footer)
    buffer.seek(0)

    return buffer


def generate_invoice_pdf(
    invoice_data: dict,
    company_data: dict,
    client_data: Optional[dict] = None,
    currency: str = "EUR",
    settings: Optional[dict] = None
) -> BytesIO:
    """
    Générer un PDF pour une facture

    Args:
        invoice_data: Données de la facture
        company_data: Données de l'entreprise
        client_data: Données du client (optionnel)
        currency: Devise
        settings: Paramètres de personnalisation (couleurs, etc.)

    Returns:
        BytesIO contenant le PDF
    """
    # Couleurs par défaut ou personnalisées
    primary_color = settings.get('primary_color', '#F5C518') if settings else '#F5C518'
    secondary_color = settings.get('secondary_color', '#1A1A1A') if settings else '#1A1A1A'
    text_color = settings.get('text_color', '#FFFFFF') if settings else '#FFFFFF'
    document_footer = settings.get('document_footer') if settings else None

    buffer = BytesIO()

    # Fonction pour dessiner le footer sur chaque page
    def add_page_footer(canvas, doc):
        if document_footer:
            canvas.saveState()
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.HexColor('#6B7280'))
            page_width = A4[0]
            text_width = canvas.stringWidth(document_footer, 'Helvetica', 8)
            x = (page_width - text_width) / 2
            canvas.drawString(x, 1.2*cm, document_footer)
            canvas.restoreState()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2.5*cm if document_footer else 2*cm
    )

    # Styles avec couleurs personnalisées
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='InvoiceTitle',
        fontSize=24,
        spaceAfter=20,
        textColor=colors.HexColor(secondary_color),
        fontName='Helvetica-Bold',
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='InvoiceSubtitle',
        fontSize=12,
        spaceAfter=6,
        textColor=colors.HexColor('#6B7280'),
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='InvoiceInfoRight',
        fontSize=10,
        textColor=colors.HexColor('#4B5563'),
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='CompanyName',
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor(secondary_color),
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle',
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor(primary_color),
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name='InvoiceNormal',
        fontSize=10,
        textColor=colors.HexColor('#4B5563'),
    ))
    styles.add(ParagraphStyle(
        name='RightAlign',
        fontSize=10,
        alignment=TA_RIGHT,
        textColor=colors.HexColor('#4B5563'),
    ))
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor(text_color),
    ))

    elements = []

    # === EN-TÊTE: Logo à gauche, Infos facture à droite ===
    logo_element = None
    logo_url = settings.get('logo_url') if settings else None
    if logo_url:
        logo_path = f"/app{logo_url}" if logo_url.startswith('/uploads') else logo_url
        if os.path.exists(logo_path):
            try:
                logo_element = Image(logo_path, width=3*cm, height=3*cm)
            except Exception:
                pass

    # Préparer les infos de la facture (colonne droite)
    invoice_info_content = []
    invoice_info_content.append(Paragraph('FACTURE', styles['InvoiceTitle']))
    invoice_info_content.append(Paragraph(f"N° {invoice_data.get('invoice_number', '')}", styles['InvoiceSubtitle']))
    invoice_info_content.append(Paragraph(f"Date: {invoice_data.get('issue_date', '')}", styles['InvoiceInfoRight']))
    invoice_info_content.append(Paragraph(f"Échéance: {invoice_data.get('due_date', '')}", styles['InvoiceInfoRight']))

    # Créer le tableau d'en-tête avec logo et infos facture
    if logo_element:
        header_table = Table([
            [logo_element, invoice_info_content]
        ], colWidths=[10*cm, 7*cm])
    else:
        header_table = Table([
            ['', invoice_info_content]
        ], colWidths=[10*cm, 7*cm])

    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.8*cm))

    # === INFOS ENTREPRISE ===
    company_info = []
    company_info.append(Paragraph(company_data.get('name', ''), styles['CompanyName']))
    if company_data.get('address'):
        company_info.append(Paragraph(company_data['address'], styles['InvoiceNormal']))
    city_line = []
    if company_data.get('postal_code'):
        city_line.append(company_data['postal_code'])
    if company_data.get('city'):
        city_line.append(company_data['city'])
    if city_line:
        company_info.append(Paragraph(' '.join(city_line), styles['InvoiceNormal']))
    if company_data.get('country'):
        company_info.append(Paragraph(company_data['country'], styles['InvoiceNormal']))
    if company_data.get('email'):
        company_info.append(Paragraph(company_data['email'], styles['InvoiceNormal']))
    if company_data.get('phone'):
        company_info.append(Paragraph(company_data['phone'], styles['InvoiceNormal']))
    if company_data.get('vat_number'):
        company_info.append(Paragraph(f"TVA: {company_data['vat_number']}", styles['InvoiceNormal']))

    for item in company_info:
        elements.append(item)
    elements.append(Spacer(1, 0.8*cm))

    # === INFORMATIONS CLIENT ===
    if client_data:
        elements.append(Paragraph('DESTINATAIRE', styles['SectionTitle']))
        client_name = client_data.get('company_name') or f"{client_data.get('first_name', '')} {client_data.get('name', '')}".strip()
        elements.append(Paragraph(f"<b>{client_name}</b>", styles['InvoiceNormal']))
        if client_data.get('address'):
            elements.append(Paragraph(client_data['address'], styles['InvoiceNormal']))
        client_city = []
        if client_data.get('postal_code'):
            client_city.append(client_data['postal_code'])
        if client_data.get('city'):
            client_city.append(client_data['city'])
        if client_city:
            elements.append(Paragraph(' '.join(client_city), styles['InvoiceNormal']))
        if client_data.get('email'):
            elements.append(Paragraph(client_data['email'], styles['InvoiceNormal']))
        elements.append(Spacer(1, 0.5*cm))

    # === DESCRIPTION / OBJET ===
    if invoice_data.get('description'):
        elements.append(Paragraph('OBJET', styles['SectionTitle']))
        elements.append(Paragraph(invoice_data['description'], styles['InvoiceNormal']))
        elements.append(Spacer(1, 0.5*cm))

    # === TABLEAU DES LIGNES ===
    elements.append(Paragraph('DÉTAIL', styles['SectionTitle']))

    table_data = [
        [
            Paragraph('Description', styles['TableHeader']),
            Paragraph('Qté', styles['TableHeader']),
            Paragraph('Prix HT', styles['TableHeader']),
            Paragraph('TVA', styles['TableHeader']),
            Paragraph('Total TTC', styles['TableHeader']),
        ]
    ]

    for item in invoice_data.get('line_items', []):
        vat_rate = item.get('vat_rate', 0)
        unit_price = item.get('unit_price', 0)
        quantity = item.get('quantity', 1)
        amount_ht = quantity * unit_price
        vat_amount = amount_ht * (vat_rate / 100)
        amount_ttc = amount_ht + vat_amount

        table_data.append([
            Paragraph(item.get('description', ''), styles['InvoiceNormal']),
            Paragraph(str(quantity), styles['InvoiceNormal']),
            Paragraph(format_currency(unit_price, currency), styles['RightAlign']),
            Paragraph(f"{vat_rate}%", styles['InvoiceNormal']),
            Paragraph(format_currency(amount_ttc, currency), styles['RightAlign']),
        ])

    col_widths = [7*cm, 1.5*cm, 3*cm, 1.5*cm, 3.5*cm]
    line_table = Table(table_data, colWidths=col_widths)
    line_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(primary_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor(text_color)),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#4B5563')),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#E5E7EB')),
        ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#E5E7EB')),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (3, -1), 'CENTER'),
        ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.5*cm))

    # === TOTAUX ===
    subtotal = invoice_data.get('subtotal', 0)
    tax_amount = invoice_data.get('tax_amount', 0)
    total = invoice_data.get('total_amount', 0)
    paid_amount = invoice_data.get('paid_amount', 0)
    remaining = total - paid_amount

    totals_col_widths = [10*cm, 3.5*cm, 3*cm]
    totals_data = [
        ['', Paragraph('Sous-total HT:', styles['RightAlign']), Paragraph(f"<b>{format_currency(subtotal, currency)}</b>", styles['RightAlign'])],
        ['', Paragraph('TVA:', styles['RightAlign']), Paragraph(f"<b>{format_currency(tax_amount, currency)}</b>", styles['RightAlign'])],
        ['', Paragraph('<b>TOTAL TTC:</b>', styles['RightAlign']), Paragraph(f"<b><font color='{primary_color}'>{format_currency(total, currency)}</font></b>", styles['RightAlign'])],
    ]

    # Ajouter les lignes de paiement si applicable
    if paid_amount > 0:
        totals_data.append(['', Paragraph('Déjà payé:', styles['RightAlign']), Paragraph(f"<b>{format_currency(paid_amount, currency)}</b>", styles['RightAlign'])])
        totals_data.append(['', Paragraph('<b>RESTE À PAYER:</b>', styles['RightAlign']), Paragraph(f"<b><font color='#DC2626'>{format_currency(remaining, currency)}</font></b>", styles['RightAlign'])])

    totals_table = Table(totals_data, colWidths=totals_col_widths)
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEABOVE', (1, 2), (2, 2), 1, colors.HexColor(secondary_color)),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 1*cm))

    # === NOTES, CONDITIONS DE PAIEMENT, RIB ===
    notes = invoice_data.get('notes') or (settings.get('default_invoice_notes') if settings else None)
    payment_terms = invoice_data.get('payment_terms') or (settings.get('default_payment_terms') if settings else None)
    bank_account = settings.get('bank_account') if settings else None

    # Notes (bloc)
    if notes:
        notes_block = [
            Paragraph('NOTES', styles['SectionTitle']),
            Paragraph(notes, styles['InvoiceNormal']),
            Spacer(1, 0.5*cm)
        ]
        elements.append(KeepTogether(notes_block))

    # Conditions de paiement (bloc)
    if payment_terms:
        payment_block = [
            Paragraph('CONDITIONS DE PAIEMENT', styles['SectionTitle']),
            Paragraph(payment_terms, styles['InvoiceNormal']),
            Spacer(1, 0.5*cm)
        ]
        elements.append(KeepTogether(payment_block))

    # Informations bancaires (bloc)
    if bank_account:
        bank_block = [Paragraph('COORDONNÉES BANCAIRES', styles['SectionTitle'])]
        bank_info = []
        if bank_account.get('bank_name'):
            bank_info.append(f"<b>Banque:</b> {bank_account['bank_name']}")
        if bank_account.get('account_holder'):
            bank_info.append(f"<b>Titulaire:</b> {bank_account['account_holder']}")
        if bank_account.get('iban'):
            bank_info.append(f"<b>IBAN:</b> {bank_account['iban']}")
        if bank_account.get('bic'):
            bank_info.append(f"<b>BIC:</b> {bank_account['bic']}")
        if bank_info:
            bank_block.append(Paragraph('<br/>'.join(bank_info), styles['InvoiceNormal']))
            bank_block.append(Spacer(1, 0.5*cm))
        elements.append(KeepTogether(bank_block))

    # Construire le PDF avec le footer sur chaque page
    doc.build(elements, onFirstPage=add_page_footer, onLaterPages=add_page_footer)
    buffer.seek(0)

    return buffer
