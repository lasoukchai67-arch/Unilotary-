import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_pin, verify_pin, create_access_token
from app.models.user import User
from app.models.finance import Wallet
from app.models.audit import LoginHistory
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse, KYCSubmitRequest
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    clean_phone = req.phone_number.strip().replace(" ", "").replace("+856", "0")
    existing = db.query(User).filter(User.phone_number == clean_phone).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered. Please login."
        )

    user_id = str(uuid.uuid4())
    ref_code = f"SX{clean_phone[-4:]}{secrets_token_hex(2).upper()}"
    new_user = User(
        user_id=user_id,
        phone_number=clean_phone,
        full_name=req.full_name.strip(),
        pin_hash=hash_pin(req.pin),
        role="Player",
        referral_code=ref_code
    )
    db.add(new_user)

    # Initial Welcome Wallet with 50,000 LAK test balance
    wallet = Wallet(
        wallet_id=str(uuid.uuid4()),
        user_id=user_id,
        currency="LAK",
        balance=Decimal("50000.00")
    )
    db.add(wallet)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": user_id, "role": new_user.role, "phone": new_user.phone_number})
    return TokenResponse(
        access_token=token,
        user_id=new_user.user_id,
        phone_number=new_user.phone_number,
        full_name=new_user.full_name,
        role=new_user.role
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    clean_phone = req.phone_number.strip().replace(" ", "").replace("+856", "0")
    user = db.query(User).filter(User.phone_number == clean_phone).first()
    if not user or not verify_pin(req.pin, user.pin_hash):
        log = LoginHistory(
            user_id=user.user_id if user else "UNKNOWN",
            phone_number=clean_phone,
            ip_address="UNKNOWN", # In production, extract from request
            device_info="UNKNOWN",
            status="FAILED"
        )
        db.add(log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or PIN."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended."
        )

    log = LoginHistory(
        user_id=user.user_id,
        phone_number=user.phone_number,
        ip_address="UNKNOWN",
        device_info="UNKNOWN",
        status="SUCCESS"
    )
    db.add(log)
    db.commit()

    token = create_access_token({"sub": user.user_id, "role": user.role, "phone": user.phone_number})
    return TokenResponse(
        access_token=token,
        user_id=user.user_id,
        phone_number=user.phone_number,
        full_name=user.full_name,
        role=user.role
    )


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    balance = float(wallet.balance) if wallet else 0.0
    return UserResponse(
        user_id=current_user.user_id,
        phone_number=current_user.phone_number,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        referral_code=current_user.referral_code,
        wallet_balance=balance,
        kyc_status=current_user.kyc_status
    )

@router.post("/kyc-submit", response_model=UserResponse)
def submit_kyc(req: KYCSubmitRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.kyc_status in ["PENDING", "VERIFIED"]:
        raise HTTPException(status_code=400, detail="KYC already submitted or verified.")
    
    current_user.id_card_number = req.id_card_number
    current_user.date_of_birth = req.date_of_birth
    current_user.id_front_image_key = req.id_front_image_key
    current_user.id_back_image_key = req.id_back_image_key
    current_user.kyc_status = "PENDING"
    
    db.commit()
    db.refresh(current_user)
    
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    balance = float(wallet.balance) if wallet else 0.0
    
    return UserResponse(
        user_id=current_user.user_id,
        phone_number=current_user.phone_number,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        referral_code=current_user.referral_code,
        wallet_balance=balance,
        kyc_status=current_user.kyc_status
    )


def secrets_token_hex(n: int) -> str:
    import secrets
    return secrets.token_hex(n)
