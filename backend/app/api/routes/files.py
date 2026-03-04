"""Proxy pour servir les fichiers stockés sur S3."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from app.core.s3 import get_s3_client, s3_enabled
from app.core.config import settings

router = APIRouter(tags=["files"])


@router.get("/files/{file_path:path}")
async def serve_file(file_path: str):
    """Sert un fichier depuis S3 en proxy (évite de rendre le bucket public)."""
    if not s3_enabled():
        raise HTTPException(status_code=404, detail="Storage not configured")

    s3 = get_s3_client()
    try:
        obj = s3.get_object(Bucket=settings.AWS_S3_BUCKET, Key=file_path)
        content = obj["Body"].read()
        content_type = obj.get("ContentType", "application/octet-stream")

        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",
            },
        )
    except s3.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
