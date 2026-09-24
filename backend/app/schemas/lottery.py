from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, time, datetime


class AnimalSchema(BaseModel):
    animal_id: int
    animal_name_lo: str
    animal_name_en: str
    base_number: str
    related_numbers: str
    icon_symbol: str


class DrawPeriodSchema(BaseModel):
    period_id: str
    period_code: str
    draw_date: str
    draw_time: str
    status: str
    winning_number_6: Optional[str] = None
    winning_animal_id: Optional[int] = None
    winning_animal_name: Optional[str] = None


class TicketItemRequest(BaseModel):
    bet_type: str = Field(..., example="DIGIT_2")  # DIGIT_1 to DIGIT_6, ANIMAL
    chosen_number: str = Field(..., example="28")
    chosen_animal_id: Optional[int] = None
    bet_amount: float = Field(..., example=10000.0, gt=0)


class BuyTicketRequest(BaseModel):
    period_id: str
    items: List[TicketItemRequest]
    payment_method: str = Field("WALLET", example="WALLET")  # WALLET or ONEPAY_QR


class TicketItemResponse(BaseModel):
    item_id: str
    bet_type: str
    chosen_number: str
    chosen_animal_id: Optional[int] = None
    bet_amount: float
    multiplier: float
    potential_win: float
    actual_win: float
    is_win: bool


class TicketResponse(BaseModel):
    ticket_id: str
    ticket_serial: str
    barcode: str
    user_id: str
    period_code: str
    draw_date: str
    draw_time: str
    total_amount: float
    total_won_amount: float
    status: str
    created_at: str
    items: List[TicketItemResponse]


class DrawResultSubmitRequest(BaseModel):
    period_id: str
    winning_number_6: str = Field(..., min_length=6, max_length=6, example="839428")
    winning_animal_id: Optional[int] = None
