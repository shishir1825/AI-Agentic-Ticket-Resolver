from __future__ import annotations

"""Document upload, text extraction, chunking, and storage."""

import os
import uuid
from pathlib import Path
from typing import Optional, List, Dict

import pdfplumber
from docx import Document as DocxDocument

from app.config import get_settings


ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "md",
}

EXTENSION_TO_MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".md": "text/markdown",
}


def resolve_mime_type(filename: str, content_type: Optional[str]) -> str:
    ext = Path(filename).suffix.lower()
    if ext in EXTENSION_TO_MIME:
        return EXTENSION_TO_MIME[ext]
    if content_type and content_type in ALLOWED_MIME_TYPES:
        return content_type
    raise ValueError(f"Unsupported file type: {ext} / {content_type}")


async def save_upload(file_bytes: bytes, filename: str) -> str:
    upload_dir = get_settings().upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{filename}"
    path = os.path.join(upload_dir, unique_name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return path


def extract_text(file_path: str, mime_type: str) -> str:
    fmt = ALLOWED_MIME_TYPES.get(mime_type, "")
    if fmt == "pdf":
        return _extract_pdf(file_path)
    elif fmt == "docx":
        return _extract_docx(file_path)
    else:
        return _extract_plain(file_path)


def _extract_pdf(path: str) -> str:
    lines: List[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines.append(text)
    return "\n".join(lines)


def _extract_docx(path: str) -> str:
    doc = DocxDocument(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_plain(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def chunk_text(text: str, chunk_size: int = 80, overlap: int = 10) -> List[Dict]:
    """Split text into overlapping chunks by line count.

    Returns list of dicts with keys: chunk_index, text, start_line, end_line.
    """
    lines = text.split("\n")
    chunks: List[Dict] = []
    idx = 0
    start = 0
    while start < len(lines):
        end = min(start + chunk_size, len(lines))
        chunk_lines = lines[start:end]
        chunks.append({
            "chunk_index": idx,
            "text": "\n".join(chunk_lines),
            "start_line": start + 1,
            "end_line": end,
        })
        idx += 1
        start += chunk_size - overlap
    return chunks
