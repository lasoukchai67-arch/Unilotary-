import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.storage_service import storage_service

router = APIRouter(prefix="/docs", tags=["Cloud Storage & Documents"])


@router.post("/upload")
async def upload_document(
    reference_id: str = Form(...),
    reference_type: str = Form("DIGITAL_TICKET_RECEIPT"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stores document in Cloud Storage and registers metadata in DB.
    """
    content = await file.read()
    res = storage_service.store_document(
        reference_id=reference_id,
        reference_type=reference_type,
        file_bytes=content,
        file_name=file.filename or "receipt.png",
        mime_type=file.content_type
    )

    doc = Document(
        doc_id=str(uuid.uuid4()),
        reference_id=reference_id,
        reference_type=reference_type,
        storage_key=res["storage_key"],
        file_name=res["file_name"],
        mime_type=res["mime_type"],
        file_size_bytes=res["file_size_bytes"],
        sha256_hash=res["sha256_hash"]
    )
    db.add(doc)
    db.commit()

    return {
        "doc_id": doc.doc_id,
        "storage_key": doc.storage_key,
        "presigned_url": res["presigned_url"],
        "sha256": doc.sha256_hash
    }


@router.get("/download")
def download_document(storage_key: str):
    """
    Retrieves document from Cloud Storage.
    """
    try:
        content = storage_service.retrieve_document(storage_key)
        return Response(content=content, media_type="application/octet-stream")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Document retrieval error: {str(e)}")
