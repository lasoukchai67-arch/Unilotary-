from pydantic import BaseModel, Field
from typing import Optional


class RegisterRequest(BaseModel):
    phone_number: str = Field(..., example="02055556666", min_length=8, max_length=15)
    full_name: str = Field(..., example="Somxay Inthavong")
    pin: str = Field(..., example="123456", min_length=4, max_length=10)
    referral_code: Optional[str] = None


class LoginRequest(BaseModel):
    phone_number: str = Field(..., example="02055556666")
    pin: str = Field(..., example="123456")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    phone_number: str
    full_name: str
    role: str


class UserResponse(BaseModel):
    user_id: str
    phone_number: str
    full_name: str
    role: str
    is_active: bool
    referral_code: Optional[str] = None
    wallet_balance: float = 0.0
    kyc_status: str = "UNVERIFIED"

class KYCSubmitRequest(BaseModel):
    id_card_number: str = Field(..., example="P1234567")
    date_of_birth: str = Field(..., example="1990-01-01")
    id_front_image_key: Optional[str] = None
    id_back_image_key: Optional[str] = None
