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


async def upload_to_s3(file: UploadFile, folder: str = "uploads") -> str:
    """Upload un fichier vers S3 et retourne l'URL publique.

    Args:
        file: Fichier uploadé
        folder: Sous-dossier dans le bucket (ex: "avatars", "logos")

    Returns:
        URL publique du fichier
    """
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    filename = f"{folder}/{uuid.uuid4().hex[:12]}.{ext}"

    s3 = get_s3_client()
    contents = await file.read()

    put_args = dict(
        Bucket=settings.AWS_S3_BUCKET,
        Key=filename,
        Body=contents,
        ContentType=file.content_type or "image/png",
    )

    # Essayer avec ACL public-read, sinon sans (bucket policy gère l'accès)
    try:
        s3.put_object(**put_args, ACL="public-read")
    except ClientError:
        s3.put_object(**put_args)

    return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_S3_REGION}.amazonaws.com/{filename}"


def delete_from_s3(url: str) -> None:
    """Supprimer un fichier de S3 à partir de son URL"""
    if not url or not s3_enabled():
        return

    prefix = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_S3_REGION}.amazonaws.com/"
    if not url.startswith(prefix):
        return

    key = url[len(prefix):]
    s3 = get_s3_client()
    try:
        s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
    except Exception:
        pass
