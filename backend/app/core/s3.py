"""Utilitaire pour l'upload de fichiers vers AWS S3"""
import boto3
from botocore.exceptions import ClientError
import uuid
from fastapi import UploadFile
from app.core.config import settings


def get_s3_client():
    """Créer un client S3"""
    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION,
    )


def s3_enabled() -> bool:
    """Vérifier si S3 est configuré"""
    return bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_S3_BUCKET)


def s3_key_from_url(url: str) -> str | None:
    """Extraire la clé S3 d'une URL (proxy ou directe)."""
    if not url:
        return None
    # URL proxy : /api/files/avatars/xxx.png
    if url.startswith("/api/files/"):
        return url[len("/api/files/"):]
    # URL S3 directe (anciens uploads)
    prefix = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_S3_REGION}.amazonaws.com/"
    if url.startswith(prefix):
        return url[len(prefix):]
    return None


async def upload_to_s3(file: UploadFile, folder: str = "uploads") -> str:
    """Upload un fichier vers S3 et retourne une URL proxy interne.

    Args:
        file: Fichier uploadé
        folder: Sous-dossier dans le bucket (ex: "avatars", "logos")

    Returns:
        URL proxy interne (/api/files/folder/xxx.ext)
    """
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    key = f"{folder}/{uuid.uuid4().hex[:12]}.{ext}"

    s3 = get_s3_client()
    contents = await file.read()

    s3.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=contents,
        ContentType=file.content_type or "image/png",
    )

    # Retourner une URL proxy pour servir via le backend
    return f"/api/files/{key}"


def delete_from_s3(url: str) -> None:
    """Supprimer un fichier de S3 à partir de son URL (proxy ou directe)"""
    if not url or not s3_enabled():
        return

    key = s3_key_from_url(url)
    if not key:
        return

    s3 = get_s3_client()
    try:
        s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
    except Exception:
        pass
