import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey
from app.core.database import Base


class Wallet(Base):
    __tablename__ = "wallets"

    wallet_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.user_id"), unique=True, nullable=False)
    currency = Column(String(3), default="LAK", nullable=False)
    balance = Column(Numeric(18, 2), default=0.00, nullable=False)
    is_frozen = Column(Boolean, default=False, nullable=False)
    
    # AML Limits
    tier_level = Column(String(10), default="TIER_1", nullable=False) # TIER_1 (Unverified), TIER_2 (Verified)
    daily_transaction_limit = Column(Numeric(18, 2), default=500000.00, nullable=False)
    monthly_transaction_limit = Column(Numeric(18, 2), default=10000000.00, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class LinkedBank(Base):
    __tablename__ = "linked_banks"
    
    bank_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    bank_name = Column(String(100), nullable=False) # BCEL, JDB, LDB
    account_name = Column(String(150), nullable=False)
    account_number = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"
    
    request_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    bank_id = Column(String(36), ForeignKey("linked_banks.bank_id"), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    status = Column(String(20), default="PENDING", nullable=False) # PENDING, APPROVED, REJECTED
    admin_notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    entry_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_group_id = Column(String(36), index=True, nullable=False)
    wallet_id = Column(String(36), ForeignKey("wallets.wallet_id"), nullable=True)
    account_name = Column(String(100), nullable=False)
    entry_type = Column(String(10), nullable=False)  # DEBIT or CREDIT
    amount = Column(Numeric(18, 2), nullable=False)
    currency = Column(String(3), default="LAK", nullable=False)
    reference_type = Column(String(50), nullable=False)  # TICKET_PURCHASE, PRIZE_PAYOUT, BANK_DEPOSIT
    reference_id = Column(String(36), nullable=True)
    narration = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
