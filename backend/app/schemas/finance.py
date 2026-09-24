from pydantic import BaseModel, Field
from typing import Optional


class WalletResponse(BaseModel):
    wallet_id: str
    user_id: str
    currency: str = "LAK"
    balance: float
    is_frozen: bool


class OnePayQRRequest(BaseModel):
    amount: float = Field(..., gt=0, example=50000.0)
    description: Optional[str] = "Lottery Wallet Deposit"


class OnePayQRResponse(BaseModel):
    qr_payload: str
    payment_ref: str
    amount: float
    currency: str = "LAK"
    expires_in_seconds: int = 600
    qr_image_data_uri: str


class TopupConfirmRequest(BaseModel):
    payment_ref: str
    amount: float

class LinkBankRequest(BaseModel):
    bank_name: str
    account_name: str
    account_number: str

class WithdrawalRequestPayload(BaseModel):
    bank_id: str
    amount: float = Field(..., gt=0)
