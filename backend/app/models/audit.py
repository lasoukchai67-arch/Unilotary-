import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from app.core.database import Base


class MutationLog(Base):
    __tablename__ = "mutation_logs"

    log_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    table_name = Column(String(100), nullable=False)
    operation = Column(String(10), nullable=False)  # INSERT, UPDATE, DELETE
    record_id = Column(String(100), nullable=False)
    old_data = Column(Text, nullable=True)
    new_data = Column(Text, nullable=True)
    changed_by = Column(String(100), nullable=False, default="SYSTEM")
    client_ip = Column(String(50), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)

class LoginHistory(Base):
    __tablename__ = "login_history"
    
    log_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    phone_number = Column(String(20), nullable=False)
    ip_address = Column(String(50), nullable=True)
    device_info = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False) # SUCCESS, FAILED
    login_time = Column(DateTime, default=datetime.utcnow)
