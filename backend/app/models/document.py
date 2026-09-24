import uuid
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, DateTime
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    doc_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    reference_id = Column(String(36), nullable=False)
    reference_type = Column(String(50), nullable=False)
    storage_key = Column(String(500), unique=True, nullable=False)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
