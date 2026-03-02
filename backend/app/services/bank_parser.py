"""
Service de parsing des fichiers bancaires (CSV et PDF)
Supporte les formats des principales banques françaises
"""
import csv
import io
import re
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import pdfplumber


@dataclass
class ParsedTransaction:
    """Transaction parsée depuis un fichier bancaire"""
    date: datetime
    description: str
    amount: float
    type: str  # 'revenue' ou 'expense'
    reference_hash: str
    raw_data: Dict[str, Any]


@dataclass
class ParseResult:
    """Résultat complet du parsing avec statistiques"""
    transactions: List[ParsedTransaction]
    total_lines: int
    parsed_lines: int
    skipped_lines: int
    skipped_reasons: Dict[str, int]  # Raison -> nombre de lignes
    format_detected: Dict[str, Any]
    sample_skipped: List[Dict[str, Any]]  # Exemples de lignes non parsées


class BankParserError(Exception):
    """Erreur lors du parsing d'un fichier bancaire"""
    pass


def generate_reference_hash(date: datetime, amount: float, description: str) -> str:
    """Génère un hash unique pour détecter les doublons"""
    data = f"{date.isoformat()}|{amount}|{description}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


def parse_french_date(date_str: str) -> Optional[datetime]:
    """Parse une date dans différents formats français"""
    if not date_str:
        return None

    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%Y-%m-%d",
        "%d/%m/%y",
        "%d-%m-%y",
        "%d.%m.%y",
        "%d %b %Y",
        "%d %B %Y",
        "%Y%m%d",
    ]

    date_str = date_str.strip()

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    return None


def parse_amount(amount_str: str) -> Tuple[float, str]:
    """
    Parse un montant et détermine s'il s'agit d'un débit ou crédit.
    Retourne (montant_absolu, type)
    """
    if not amount_str:
        raise BankParserError("Montant vide")

    # Nettoyer la chaîne
    original = amount_str
    amount_str = amount_str.strip()

    # Gérer les espaces comme séparateurs de milliers
    amount_str = amount_str.replace(' ', '').replace('\xa0', '').replace('\u202f', '')

    # Détecter le signe
    is_negative = False
    if amount_str.startswith('-') or amount_str.startswith('−') or amount_str.startswith('–'):
        is_negative = True
        amount_str = amount_str[1:]
    elif amount_str.endswith('-'):
        is_negative = True
        amount_str = amount_str[:-1]
    elif amount_str.startswith('(') and amount_str.endswith(')'):
        is_negative = True
        amount_str = amount_str[1:-1]

    # Supprimer les symboles de devise
    amount_str = re.sub(r'[€$£¥EUR]', '', amount_str, flags=re.IGNORECASE)
    amount_str = amount_str.strip()

    # Gérer les virgules et points (format français: 1 234,56)
    # Compter les occurrences
    comma_count = amount_str.count(',')
    dot_count = amount_str.count('.')

    if comma_count == 1 and dot_count == 0:
        # Format français simple: 1234,56
        amount_str = amount_str.replace(',', '.')
    elif comma_count == 0 and dot_count == 1:
        # Format anglais: 1234.56 (déjà bon)
        pass
    elif comma_count >= 1 and dot_count >= 1:
        # Format mixte
        last_comma = amount_str.rfind(',')
        last_dot = amount_str.rfind('.')

        if last_comma > last_dot:
            # Virgule est le séparateur décimal: 1.234,56
            amount_str = amount_str.replace('.', '').replace(',', '.')
        else:
            # Point est le séparateur décimal: 1,234.56
            amount_str = amount_str.replace(',', '')
    elif comma_count > 1:
        # Plusieurs virgules = séparateurs de milliers: 1,234,567
        amount_str = amount_str.replace(',', '')
    elif dot_count > 1:
        # Plusieurs points = séparateurs de milliers: 1.234.567
        amount_str = amount_str.replace('.', '')

    try:
        amount = abs(float(amount_str))
    except ValueError:
        raise BankParserError(f"Impossible de parser le montant: {original}")

    transaction_type = 'expense' if is_negative else 'revenue'

    return amount, transaction_type


def detect_csv_format(content: str) -> Dict[str, Any]:
    """Détecte automatiquement le format du CSV (délimiteur, colonnes)"""

    # Liste des noms de colonnes possibles (avec variantes d'encodage/accents)
    date_keywords = ['date', 'datum', 'fecha', 'date opération', 'date operation', 'dateop',
                     'date comptable', 'date compta', 'date valeur', "date d'opera", "date d'opération",
                     "date d'opéra"]
    desc_keywords = ['libellé', 'libelle', 'description', 'détail', 'detail', 'motif', 'label',
                     'communication', 'nom', 'intitulé', 'intitule', 'libellé opération',
                     'libelle opere', 'libellé opéré', 'objet', 'libelle complementaire']
    amount_keywords = ['montant', 'amount', 'somme', 'valeur', 'montant eur', 'montant €',
                       'montant (eur)', 'montant en euro']
    debit_keywords = ['débit', 'debit', 'dÉbit', 'sortie', 'dépense', 'depense',
                      'débit eur', 'debit eur', 'retrait']
    credit_keywords = ['crédit', 'credit', 'crÉdit', 'entrée', 'entree', 'recette',
                       'crédit eur', 'credit eur', 'versement']
    # Colonnes à ignorer
    ignore_keywords = ['solde', 'balance', 'cumul', 'reference', 'référence', 'ref']

    lines = content.strip().split('\n')
    if not lines:
        return {
            'delimiter': ';',
            'date_col': 0,
            'desc_col': 1,
            'libelle_comp_col': None,
            'amount_col': 2,
            'debit_col': None,
            'credit_col': None,
            'has_header': True,
            'header_line': 0
        }

    # D'abord, détecter le délimiteur le plus probable en analysant plusieurs lignes
    delimiter_scores = {';': 0, ',': 0, '\t': 0, '|': 0}

    for line in lines[:10]:
        for delim in delimiter_scores:
            count = line.count(delim)
            if count >= 2:  # Au moins 3 colonnes
                delimiter_scores[delim] += count

    # Trier les délimiteurs par score décroissant
    sorted_delimiters = sorted(delimiter_scores.keys(), key=lambda d: delimiter_scores[d], reverse=True)

    # Essayer les délimiteurs dans l'ordre de probabilité
    for delimiter in sorted_delimiters:
        if delimiter_scores[delimiter] == 0:
            continue

        try:
            # Trouver la ligne d'en-tête (peut ne pas être la première)
            header_line_idx = 0
            header = None
            best_header_score = 0

            for idx, line in enumerate(lines[:10]):  # Chercher dans les 10 premières lignes
                reader = csv.reader(io.StringIO(line), delimiter=delimiter)
                row = next(reader, None)

                if row and len(row) >= 3:
                    # Vérifier si c'est une ligne d'en-tête en comptant les mots-clés
                    row_lower = [str(c).lower().strip() for c in row]

                    header_score = 0
                    has_date = any(any(k in c for k in date_keywords) for c in row_lower)
                    has_debit = any(any(k in c for k in debit_keywords) for c in row_lower)
                    has_credit = any(any(k in c for k in credit_keywords) for c in row_lower)
                    has_amount = any(any(k in c for k in amount_keywords) for c in row_lower)
                    has_desc = any(any(k in c for k in desc_keywords) for c in row_lower)

                    if has_date:
                        header_score += 2
                    if has_debit:
                        header_score += 2
                    if has_credit:
                        header_score += 2
                    if has_amount:
                        header_score += 2
                    if has_desc:
                        header_score += 1

                    # Garder la ligne avec le meilleur score
                    if header_score > best_header_score:
                        best_header_score = header_score
                        header = row
                        header_line_idx = idx

            if not header or best_header_score == 0:
                # Pas d'en-tête trouvé avec ce délimiteur, essayer le suivant
                continue

            if len(header) < 3:
                continue

            # Détecter les colonnes importantes
            date_col = None
            date_valeur_col = None  # Pour "Date de valeur" séparée
            desc_col = None
            amount_col = None
            debit_col = None
            credit_col = None

            header_lower = [str(h).lower().strip() for h in header]

            # Chercher aussi une colonne "libelle complementaire" pour description étendue
            libelle_comp_col = None

            for i, h in enumerate(header_lower):
                # Ignorer les colonnes de solde/balance
                if any(k in h for k in ignore_keywords):
                    continue

                # Normaliser pour gérer les accents mal encodés
                h_normalized = h.replace('é', 'e').replace('è', 'e').replace('ê', 'e')
                h_normalized = h_normalized.replace('É', 'e').replace('È', 'e').replace('Ê', 'e')

                # Détection des colonnes de date (préférer date d'opération à date de valeur)
                if 'date' in h:
                    if 'valeur' in h:
                        date_valeur_col = i
                    elif date_col is None:
                        date_col = i
                elif 'libelle complementaire' in h or 'libellé complémentaire' in h or 'libelle comp' in h_normalized:
                    libelle_comp_col = i
                elif desc_col is None and (any(k in h for k in desc_keywords) or 'libelle oper' in h_normalized):
                    desc_col = i
                elif amount_col is None and any(k in h for k in amount_keywords):
                    amount_col = i
                elif debit_col is None and any(k in h for k in debit_keywords):
                    debit_col = i
                elif credit_col is None and any(k in h for k in credit_keywords):
                    credit_col = i

            # Si pas de date d'opération trouvée mais une date de valeur, utiliser celle-ci
            if date_col is None and date_valeur_col is not None:
                date_col = date_valeur_col

            # Si pas de colonne description trouvée, chercher une colonne texte longue
            if desc_col is None:
                # Lire quelques lignes pour trouver la colonne avec le plus de texte
                sample_reader = csv.reader(io.StringIO('\n'.join(lines[header_line_idx+1:header_line_idx+5])), delimiter=delimiter)
                text_lengths = {}
                for sample_row in sample_reader:
                    for i, cell in enumerate(sample_row):
                        if i not in [date_col, amount_col, debit_col, credit_col]:
                            cell_str = str(cell).strip()
                            if len(cell_str) > 10 and not re.match(r'^[\d\s,.\-+€$]+$', cell_str):
                                text_lengths[i] = text_lengths.get(i, 0) + len(cell_str)

                if text_lengths:
                    desc_col = max(text_lengths, key=text_lengths.get)

            has_amounts = amount_col is not None or (debit_col is not None or credit_col is not None)

            if date_col is not None and has_amounts:
                return {
                    'delimiter': delimiter,
                    'date_col': date_col,
                    'desc_col': desc_col if desc_col is not None else (1 if date_col != 1 else 2),
                    'libelle_comp_col': libelle_comp_col,
                    'amount_col': amount_col,
                    'debit_col': debit_col,
                    'credit_col': credit_col,
                    'has_header': True,
                    'header_line': header_line_idx
                }
        except Exception as e:
            continue

    # Format non détecté, essayer avec des positions par défaut
    return {
        'delimiter': ';',
        'date_col': 0,
        'desc_col': 1,
        'libelle_comp_col': None,
        'amount_col': 2,
        'debit_col': None,
        'credit_col': None,
        'has_header': True,
        'header_line': 0
    }


def parse_csv_bank_statement(content: str, return_details: bool = False) -> List[ParsedTransaction]:
    """Parse un fichier CSV de relevé bancaire"""
    transactions = []
    skipped_reasons = {
        'row_too_short': 0,
        'no_date': 0,
        'no_amount': 0,
        'zero_amount': 0,
        'parse_error': 0,
    }
    sample_skipped = []

    # Détecter le format
    format_info = detect_csv_format(content)

    lines = content.strip().split('\n')
    total_lines = len(lines)

    # Sauter jusqu'après l'en-tête
    start_line = format_info.get('header_line', 0) + 1 if format_info['has_header'] else 0
    content_to_parse = '\n'.join(lines[start_line:])

    reader = csv.reader(io.StringIO(content_to_parse), delimiter=format_info['delimiter'])

    for row_num, row in enumerate(reader, start=start_line + 1):
        skip_reason = None

        try:
            if len(row) < 2:
                skip_reason = 'row_too_short'
                skipped_reasons['row_too_short'] += 1
                if len(sample_skipped) < 5:
                    sample_skipped.append({'row': row_num, 'reason': skip_reason, 'data': row[:3] if row else []})
                continue

            # Extraire la date
            date_str = row[format_info['date_col']] if format_info['date_col'] < len(row) else ''
            date = parse_french_date(date_str)
            if not date:
                skip_reason = 'no_date'
                skipped_reasons['no_date'] += 1
                if len(sample_skipped) < 5:
                    sample_skipped.append({'row': row_num, 'reason': skip_reason, 'date_col': format_info['date_col'], 'date_value': date_str, 'data': row[:5] if row else []})
                continue

            # Extraire la description
            desc_col = format_info['desc_col']
            desc = row[desc_col] if desc_col is not None and desc_col < len(row) else ''
            desc = desc.strip()

            # Ajouter le libellé complémentaire si présent
            libelle_comp_col = format_info.get('libelle_comp_col')
            if libelle_comp_col is not None and libelle_comp_col < len(row):
                libelle_comp = str(row[libelle_comp_col]).strip()
                if libelle_comp and libelle_comp != desc:
                    # Combiner les deux libellés
                    if desc:
                        desc = f"{desc} - {libelle_comp}"
                    else:
                        desc = libelle_comp

            # Si description vide, essayer de combiner d'autres colonnes
            if not desc:
                other_cols = [str(row[i]).strip() for i in range(len(row))
                             if i not in [format_info['date_col'], format_info['amount_col'],
                                         format_info['debit_col'], format_info['credit_col'],
                                         format_info.get('libelle_comp_col')]
                             and row[i] and len(str(row[i]).strip()) > 3]
                desc = ' '.join(other_cols)

            if not desc:
                desc = "Transaction sans libellé"

            # Extraire le montant
            amount = None
            trans_type = None

            if format_info['amount_col'] is not None:
                amount_str = row[format_info['amount_col']] if format_info['amount_col'] < len(row) else ''
                if amount_str.strip():
                    try:
                        amount, trans_type = parse_amount(amount_str)
                    except BankParserError:
                        pass

            if amount is None and format_info['debit_col'] is not None:
                # Colonnes débit/crédit séparées
                debit_str = row[format_info['debit_col']] if format_info['debit_col'] < len(row) else ''

                # Nettoyer et vérifier le débit
                debit_clean = debit_str.strip().replace(' ', '').replace('\xa0', '').replace('\u202f', '')
                # Enlever le signe pour la comparaison
                debit_clean_abs = debit_clean.lstrip('-−–+')
                if debit_clean_abs and debit_clean_abs not in ['0', '0,00', '0.00', '']:
                    try:
                        amount, _ = parse_amount(debit_str)
                        # Un débit est toujours une dépense, peu importe le signe dans le fichier
                        trans_type = 'expense'
                    except BankParserError:
                        pass

            if amount is None and format_info['credit_col'] is not None:
                credit_str = row[format_info['credit_col']] if format_info['credit_col'] < len(row) else ''

                # Nettoyer et vérifier le crédit
                credit_clean = credit_str.strip().replace(' ', '').replace('\xa0', '').replace('\u202f', '')
                credit_clean_abs = credit_clean.lstrip('-−–+')
                if credit_clean_abs and credit_clean_abs not in ['0', '0,00', '0.00', '']:
                    try:
                        amount, _ = parse_amount(credit_str)
                        # Un crédit est toujours un revenu, peu importe le signe dans le fichier
                        trans_type = 'revenue'
                    except BankParserError:
                        pass

            # Si toujours pas de montant, chercher dans toutes les colonnes
            if amount is None:
                for i, cell in enumerate(row):
                    if i == format_info['date_col'] or i == format_info.get('desc_col'):
                        continue
                    cell = str(cell).strip()
                    # Chercher une cellule qui ressemble à un montant
                    if re.match(r'^[\-\+]?[\d\s,.]+[€]?$', cell) and len(cell) > 1:
                        try:
                            amount, trans_type = parse_amount(cell)
                            if amount > 0:
                                break
                        except BankParserError:
                            continue

            if amount is None:
                skip_reason = 'no_amount'
                skipped_reasons['no_amount'] += 1
                if len(sample_skipped) < 5:
                    sample_skipped.append({
                        'row': row_num,
                        'reason': skip_reason,
                        'debit_col': format_info.get('debit_col'),
                        'credit_col': format_info.get('credit_col'),
                        'amount_col': format_info.get('amount_col'),
                        'data': row
                    })
                continue

            if amount == 0:
                skip_reason = 'zero_amount'
                skipped_reasons['zero_amount'] += 1
                continue

            # Générer le hash de référence
            ref_hash = generate_reference_hash(date, amount, desc)

            transactions.append(ParsedTransaction(
                date=date,
                description=desc,
                amount=amount,
                type=trans_type,
                reference_hash=ref_hash,
                raw_data={'row': row, 'row_num': row_num}
            ))

        except Exception as e:
            skipped_reasons['parse_error'] += 1
            if len(sample_skipped) < 5:
                sample_skipped.append({'row': row_num, 'reason': 'parse_error', 'error': str(e), 'data': row[:5] if row else []})
            continue

    # Si return_details est demandé, retourner un ParseResult
    if return_details:
        return ParseResult(
            transactions=transactions,
            total_lines=total_lines,
            parsed_lines=len(transactions),
            skipped_lines=sum(skipped_reasons.values()),
            skipped_reasons=skipped_reasons,
            format_detected=format_info,
            sample_skipped=sample_skipped
        )

    return transactions


def parse_pdf_bank_statement(file_path: str) -> List[ParsedTransaction]:
    """Parse un fichier PDF de relevé bancaire"""
    transactions = []

    try:
        with pdfplumber.open(file_path) as pdf:
            full_text = ""

            for page in pdf.pages:
                # Extraire les tables si présentes
                tables = page.extract_tables()

                for table in tables:
                    if not table:
                        continue

                    # Analyser l'en-tête de la table pour trouver les colonnes
                    header_row = None
                    date_col = None
                    desc_col = None
                    debit_col = None
                    credit_col = None
                    amount_col = None

                    for row_idx, row in enumerate(table):
                        if not row:
                            continue

                        row_str = [str(c).lower().strip() if c else '' for c in row]

                        # Chercher la ligne d'en-tête
                        if any('date' in c for c in row_str):
                            header_row = row_idx
                            for i, cell in enumerate(row_str):
                                if 'date' in cell:
                                    date_col = i
                                elif any(k in cell for k in ['libellé', 'libelle', 'description', 'opération', 'operation']):
                                    desc_col = i
                                elif any(k in cell for k in ['débit', 'debit', 'sortie']):
                                    debit_col = i
                                elif any(k in cell for k in ['crédit', 'credit', 'entrée', 'entree']):
                                    credit_col = i
                                elif any(k in cell for k in ['montant', 'amount']):
                                    amount_col = i
                            break

                    # Parser les lignes de données
                    start_row = (header_row + 1) if header_row is not None else 0

                    for row in table[start_row:]:
                        if not row or len(row) < 2:
                            continue

                        # Si on a trouvé les colonnes
                        if date_col is not None:
                            date_str = str(row[date_col]).strip() if date_col < len(row) and row[date_col] else ''
                            date = parse_french_date(date_str)

                            if not date:
                                continue

                            desc = str(row[desc_col]).strip() if desc_col is not None and desc_col < len(row) and row[desc_col] else ''

                            amount = None
                            trans_type = None

                            if amount_col is not None and amount_col < len(row) and row[amount_col]:
                                try:
                                    amount, trans_type = parse_amount(str(row[amount_col]))
                                except:
                                    pass

                            if amount is None:
                                if debit_col is not None and debit_col < len(row) and row[debit_col]:
                                    debit_str = str(row[debit_col]).strip()
                                    if debit_str and debit_str not in ['', '0', '0,00']:
                                        try:
                                            amount, _ = parse_amount(debit_str)
                                            trans_type = 'expense'
                                        except:
                                            pass

                                if amount is None and credit_col is not None and credit_col < len(row) and row[credit_col]:
                                    credit_str = str(row[credit_col]).strip()
                                    if credit_str and credit_str not in ['', '0', '0,00']:
                                        try:
                                            amount, _ = parse_amount(credit_str)
                                            trans_type = 'revenue'
                                        except:
                                            pass

                            if date and amount and amount > 0:
                                if not desc:
                                    desc = "Transaction bancaire"
                                ref_hash = generate_reference_hash(date, amount, desc)
                                transactions.append(ParsedTransaction(
                                    date=date,
                                    description=desc,
                                    amount=amount,
                                    type=trans_type or 'expense',
                                    reference_hash=ref_hash,
                                    raw_data={'source': 'pdf_table'}
                                ))
                        else:
                            # Pas d'en-tête trouvé, essayer de parser chaque cellule
                            date = None
                            desc = None
                            amount = None
                            trans_type = None

                            for cell in row:
                                if not cell:
                                    continue

                                cell = str(cell).strip()

                                # Essayer de parser comme date
                                if not date:
                                    parsed_date = parse_french_date(cell)
                                    if parsed_date:
                                        date = parsed_date
                                        continue

                                # Essayer de parser comme montant
                                if not amount and re.search(r'[\d,.\-]+', cell):
                                    # Vérifier que c'est bien un montant
                                    clean_cell = re.sub(r'[^\d,.\-+]', '', cell)
                                    if clean_cell and len(clean_cell) > 1:
                                        try:
                                            amount, trans_type = parse_amount(cell)
                                            if amount > 0:
                                                continue
                                            else:
                                                amount = None
                                        except:
                                            pass

                                # Sinon, c'est probablement la description
                                if not desc and len(cell) > 5 and not re.match(r'^[\d\s,.\-+€$]+$', cell):
                                    desc = cell

                            if date and amount and amount > 0:
                                if not desc:
                                    desc = "Transaction bancaire"
                                ref_hash = generate_reference_hash(date, amount, desc)
                                transactions.append(ParsedTransaction(
                                    date=date,
                                    description=desc,
                                    amount=amount,
                                    type=trans_type or 'expense',
                                    reference_hash=ref_hash,
                                    raw_data={'source': 'pdf_table'}
                                ))

                # Extraire aussi le texte brut pour compléter
                page_text = page.extract_text() or ""
                if page_text:
                    full_text += page_text + "\n"

            # Parser le texte brut si pas assez de transactions trouvées dans les tables
            if len(transactions) < 3 and full_text:
                # Patterns courants pour les transactions bancaires françaises
                patterns = [
                    # Format: DD/MM/YYYY ou DD/MM/YY DESCRIPTION MONTANT
                    r'(\d{2}[/\-\.]\d{2}[/\-\.]\d{2,4})\s+(.{10,50}?)\s+([\-\+]?[\d\s]+[,.][\d]{2})\s*€?',
                    # Format: DATE DESCRIPTION DEBIT CREDIT
                    r'(\d{2}[/\-\.]\d{2}[/\-\.]\d{2,4})\s+(.{5,}?)\s+([\d\s]+[,.][\d]{2})?\s+([\d\s]+[,.][\d]{2})?',
                ]

                for pattern in patterns:
                    matches = re.findall(pattern, full_text)

                    for match in matches:
                        if len(match) >= 3:
                            date_str = match[0]
                            desc = match[1].strip()

                            date = parse_french_date(date_str)
                            if not date:
                                continue

                            amount = None
                            trans_type = None

                            # Essayer le montant principal
                            if match[2]:
                                try:
                                    amount, trans_type = parse_amount(match[2])
                                except:
                                    pass

                            # Si format débit/crédit
                            if len(match) >= 4 and match[3] and not amount:
                                try:
                                    amount, _ = parse_amount(match[3])
                                    trans_type = 'revenue'
                                except:
                                    pass

                            if amount and amount > 0 and desc:
                                # Vérifier que cette transaction n'existe pas déjà
                                ref_hash = generate_reference_hash(date, amount, desc)
                                if not any(t.reference_hash == ref_hash for t in transactions):
                                    transactions.append(ParsedTransaction(
                                        date=date,
                                        description=desc,
                                        amount=amount,
                                        type=trans_type or 'expense',
                                        reference_hash=ref_hash,
                                        raw_data={'source': 'pdf_text'}
                                    ))

    except Exception as e:
        raise BankParserError(f"Erreur lors du parsing du PDF: {str(e)}")

    return transactions


def apply_categorization_rules(
    transactions: List[ParsedTransaction],
    rules: List[Dict[str, Any]]
) -> List[ParsedTransaction]:
    """
    Applique les règles de catégorisation aux transactions.
    Les règles doivent être triées par priorité décroissante.

    Une règle peut avoir:
    - Un pattern (texte à rechercher dans la description)
    - Un source_type (type de transaction à filtrer: revenue/expense)
    - Les deux (les deux conditions doivent être vraies)
    """
    for transaction in transactions:
        for rule in rules:
            # Vérifier le filtre par type de transaction source
            source_type = rule.get('source_type')
            if source_type:
                # Si source_type est défini, la transaction doit correspondre
                if transaction.type != source_type:
                    continue  # Pas de match, passer à la règle suivante

            # Vérifier le pattern de description
            pattern = rule.get('pattern')
            pattern_matched = True  # Par défaut, pas de filtre pattern

            if pattern:
                pattern = pattern.lower()
                desc_lower = transaction.description.lower()
                match_type = rule.get('match_type', 'contains')

                pattern_matched = False

                if match_type == 'contains':
                    pattern_matched = pattern in desc_lower
                elif match_type == 'starts_with':
                    pattern_matched = desc_lower.startswith(pattern)
                elif match_type == 'exact':
                    pattern_matched = desc_lower == pattern
                elif match_type == 'regex':
                    try:
                        pattern_matched = bool(re.search(pattern, desc_lower, re.IGNORECASE))
                    except re.error:
                        pass

            # Si la règle n'a ni pattern ni source_type, elle ne match rien
            if not pattern and not source_type:
                continue

            if pattern_matched:
                # Stocker l'info de catégorisation dans raw_data
                transaction.raw_data['matched_rule_id'] = rule['id']
                transaction.raw_data['category_id'] = rule['category_id']

                # Forcer le type si défini dans la règle
                if rule.get('transaction_type'):
                    transaction.type = rule['transaction_type']

                break  # Première règle qui match gagne

    return transactions
