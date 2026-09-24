import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = Column(String(20), unique=True, index=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    pin_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="Player", nullable=False)  # Player, Agent, Auditor, Admin
    is_active = Column(Boolean, default=True, nullable=False)
    referral_code = Column(String(30), unique=True, nullable=True)
    referred_by = Column(String(36), nullable=True)
    
    # KYC (Know Your Customer) Fields for BOL Compliance
    kyc_status = Column(String(20), default="UNVERIFIED", nullable=False) # UNVERIFIED, PENDING, VERIFIED, REJECTED
    id_card_number = Column(String(50), unique=True, nullable=True)
    date_of_birth = Column(String(20), nullable=True) # YYYY-MM-DD
    id_front_image_key = Column(String(255), nullable=True)
    id_back_image_key = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
