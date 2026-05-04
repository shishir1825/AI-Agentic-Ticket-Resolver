from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.document import Document, DocumentChunk
from app.models.run import Run
from app.schemas.document import DocumentUploadResponse, DocumentResponse
from app.services import document_service

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    uploader_user_id: str = Form(default="anonymous"),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    try:
        mime_type = document_service.resolve_mime_type(file.filename, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    file_bytes = await file.read()
    storage_uri = await document_service.save_upload(file_bytes, file.filename)

    extracted_text = document_service.extract_text(storage_uri, mime_type)

    doc = Document(
        uploader_user_id=uploader_user_id,
        filename=file.filename,
        mime_type=mime_type,
        storage_uri=storage_uri,
        extracted_text=extracted_text,
    )
    db.add(doc)
    await db.flush()

    chunks = document_service.chunk_text(extracted_text)
    for c in chunks:
        db.add(DocumentChunk(
            document_id=doc.id,
            chunk_index=c["chunk_index"],
            text=c["text"],
            start_line=c["start_line"],
            end_line=c["end_line"],
        ))

    run = Run(document_id=doc.id, status="processing", current_step="agent1")
    db.add(run)
    await db.commit()
    await db.refresh(doc)
    await db.refresh(run)

    return DocumentUploadResponse(document_id=doc.id, run_id=run.id, filename=file.filename)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
