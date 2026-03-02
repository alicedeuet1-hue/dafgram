"""
Service pour parser les documents (PDF, CSV) avec OCR
"""
import os
import pytesseract
from PIL import Image
import pdfplumber
import pandas as pd
import re
from typing import Dict, List, Optional
from datetime import datetime
import magic


class DocumentParser:
    """Parser pour extraire des données de documents"""

    @staticmethod
    def detect_file_type(filepath: str) -> str:
        """Détecter le type de fichier"""
        mime = magic.Magic(mime=True)
        file_type = mime.from_file(filepath)
        return file_type

    @staticmethod
    def parse_csv(filepath: str) -> List[Dict]:
        """Parser un fichier CSV"""
        try:
            # Essayer différents délimiteurs
            for delimiter in [',', ';', '\t']:
                try:
                    df = pd.read_csv(filepath, delimiter=delimiter)
                    if len(df.columns) > 1:
                        break
                except:
                    continue

            # Normaliser les noms de colonnes
            df.columns = df.columns.str.lower().str.strip()

            # Convertir en liste de dictionnaires
            records = df.to_dict('records')

            # Nettoyer les données
            cleaned_records = []
            for record in records:
                cleaned = {k: v for k, v in record.items() if pd.notna(v)}
                cleaned_records.append(cleaned)

            return cleaned_records

        except Exception as e:
            raise Exception(f"Error parsing CSV: {str(e)}")

    @staticmethod
    def parse_pdf_with_text(filepath: str) -> str:
        """Extraire le texte d'un PDF avec pdfplumber"""
        try:
            text = ""
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            return text
        except Exception as e:
            raise Exception(f"Error parsing PDF with text extraction: {str(e)}")

    @staticmethod
    def parse_pdf_with_ocr(filepath: str) -> str:
        """Extraire le texte d'un PDF avec OCR (Tesseract)"""
        try:
            # TODO: Convertir PDF en images puis appliquer OCR
            # Nécessite pdf2image (poppler-utils)
            # Pour l'instant, retourne un message
            return "OCR parsing requires pdf2image library (not yet implemented)"
        except Exception as e:
            raise Exception(f"Error parsing PDF with OCR: {str(e)}")

    @staticmethod
    def extract_transactions_from_text(text: str) -> List[Dict]:
        """
        Extraire les transactions du texte avec des patterns regex
        Format attendu: DATE | DESCRIPTION | MONTANT
        """
        transactions = []

        # Patterns pour détecter les montants (EUR, €, etc.)
        amount_pattern = r'[-+]?\d+[,.]?\d*\s*[€EUR]?'
        # Patterns pour détecter les dates
        date_pattern = r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}'

        lines = text.split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Chercher les dates
            date_match = re.search(date_pattern, line)
            # Chercher les montants
            amount_matches = re.findall(amount_pattern, line)

            if date_match and amount_matches:
                # Essayer de parser la date
                date_str = date_match.group()
                try:
                    # Plusieurs formats de date possibles
                    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y']:
                        try:
                            transaction_date = datetime.strptime(date_str, fmt)
                            break
                        except:
                            continue
                except:
                    transaction_date = None

                # Parser le montant
                for amount_str in amount_matches:
                    amount_clean = amount_str.replace('€', '').replace('EUR', '').replace(',', '.').strip()
                    try:
                        amount = float(amount_clean)

                        # Extraire la description (tout ce qui n'est pas date/montant)
                        description = line
                        if date_match:
                            description = description.replace(date_match.group(), '')
                        for amt in amount_matches:
                            description = description.replace(amt, '')
                        description = description.strip()

                        transactions.append({
                            'date': transaction_date,
                            'description': description,
                            'amount': amount
                        })
                        break  # Prendre seulement le premier montant trouvé
                    except:
                        continue

        return transactions

    @staticmethod
    def parse_document(filepath: str) -> Dict:
        """
        Parser un document et retourner les données structurées
        """
        file_type = DocumentParser.detect_file_type(filepath)

        result = {
            'file_type': file_type,
            'raw_text': '',
            'transactions': [],
            'errors': []
        }

        try:
            if 'csv' in file_type or filepath.endswith('.csv'):
                # Parser CSV
                records = DocumentParser.parse_csv(filepath)
                result['transactions'] = DocumentParser.convert_csv_to_transactions(records)

            elif 'pdf' in file_type or filepath.endswith('.pdf'):
                # Parser PDF
                text = DocumentParser.parse_pdf_with_text(filepath)
                result['raw_text'] = text

                # Si pas de texte, essayer OCR
                if not text.strip():
                    text = DocumentParser.parse_pdf_with_ocr(filepath)
                    result['raw_text'] = text

                # Extraire les transactions du texte
                result['transactions'] = DocumentParser.extract_transactions_from_text(text)

            else:
                result['errors'].append(f"Unsupported file type: {file_type}")

        except Exception as e:
            result['errors'].append(str(e))

        return result

    @staticmethod
    def convert_csv_to_transactions(records: List[Dict]) -> List[Dict]:
        """
        Convertir les enregistrements CSV en format transaction
        Essaie de détecter automatiquement les colonnes
        """
        transactions = []

        # Noms de colonnes possibles
        date_columns = ['date', 'transaction_date', 'date_transaction', 'datum']
        amount_columns = ['amount', 'montant', 'total', 'price', 'prix', 'betrag']
        description_columns = ['description', 'libelle', 'label', 'libellé', 'bezeichnung']

        for record in records:
            transaction = {}

            # Trouver la colonne de date
            for col in date_columns:
                if col in record:
                    try:
                        # Essayer de parser la date
                        date_val = record[col]
                        if isinstance(date_val, str):
                            for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%y']:
                                try:
                                    transaction['date'] = datetime.strptime(date_val, fmt)
                                    break
                                except:
                                    continue
                    except:
                        pass
                    break

            # Trouver la colonne de montant
            for col in amount_columns:
                if col in record:
                    try:
                        amount_val = record[col]
                        if isinstance(amount_val, str):
                            amount_val = amount_val.replace(',', '.').replace('€', '').strip()
                        transaction['amount'] = float(amount_val)
                    except:
                        pass
                    break

            # Trouver la colonne de description
            for col in description_columns:
                if col in record:
                    transaction['description'] = str(record[col])
                    break

            # Si on a au moins un montant, ajouter la transaction
            if 'amount' in transaction:
                transactions.append(transaction)

        return transactions
