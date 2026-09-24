import uuid
from datetime import datetime, date, time
from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, Date, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Animal(Base):
    __tablename__ = "animals"

    animal_id = Column(Integer, primary_key=True)
    animal_name_lo = Column(String(100), nullable=False)
    animal_name_en = Column(String(100), nullable=False)
    base_number = Column(String(2), nullable=False)
    related_numbers = Column(String(50), nullable=False)
    icon_symbol = Column(String(20), nullable=False)


class DrawPeriod(Base):
    __tablename__ = "draw_periods"

    period_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_code = Column(String(30), unique=True, nullable=False)
    draw_date = Column(Date, nullable=False)
    draw_time = Column(Time, default=time(20, 0, 0), nullable=False)
    status = Column(String(20), default="OPEN", nullable=False)  # OPEN, CLOSED, DRAWN, CANCELLED
    winning_number_6 = Column(String(6), nullable=True)
    winning_animal_id = Column(Integer, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    drawn_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tickets = relationship("Ticket", back_populates="period")


class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_serial = Column(String(64), unique=True, index=True, nullable=False)
    barcode = Column(String(64), unique=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    period_id = Column(String(36), ForeignKey("draw_periods.period_id"), nullable=False)
    total_amount = Column(Numeric(15, 2), nullable=False)
    total_won_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, WON, LOST, CANCELLED
    payment_ref = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    period = relationship("DrawPeriod", back_populates="tickets")
    items = relationship("TicketItem", back_populates="ticket", cascade="all, delete-orphan")


class TicketItem(Base):
    __tablename__ = "ticket_items"

    item_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.ticket_id"), nullable=False)
    bet_type = Column(String(20), nullable=False)  # DIGIT_1 to DIGIT_6, ANIMAL
    chosen_number = Column(String(10), nullable=False)
    chosen_animal_id = Column(Integer, nullable=True)
    bet_amount = Column(Numeric(15, 2), nullable=False)
    multiplier = Column(Numeric(10, 2), nullable=False)
    potential_win = Column(Numeric(15, 2), nullable=False)
    actual_win = Column(Numeric(15, 2), default=0.00, nullable=False)
    is_win = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="items")
