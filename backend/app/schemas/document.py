"""Schémas pour les documents"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict


class DocumentResponse(BaseModel):
    id: int
    company_id: int
    filename: str
    file_type: str
    file_size: int
    processed: bool
    processing_error: Optional[str] = None
    extracted_data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentUploadResponse(BaseModel):
    message: str
    document: DocumentResponse
    transactions_created: int = 0


class ProcessedData(BaseModel):
    """Données extraites du document"""
    raw_text: str
    transactions: list
    errors: list
