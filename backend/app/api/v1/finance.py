import uuid
import secrets
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.finance import Wallet, LedgerEntry, LinkedBank, WithdrawalRequest
from app.schemas.finance import WalletResponse, OnePayQRRequest, OnePayQRResponse, TopupConfirmRequest, LinkBankRequest, WithdrawalRequestPayload
from app.services.ledger_service import LedgerService

router = APIRouter(prefix="/finance", tags=["Finance & Double-Entry Ledger"])


@router.get("/wallet", response_model=WalletResponse)
def get_wallet(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    if not wallet:
        wallet = Wallet(
            wallet_id=str(uuid.uuid4()),
            user_id=current_user.user_id,
            currency="LAK",
            balance=Decimal("0.00")
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    return WalletResponse(
        wallet_id=wallet.wallet_id,
        user_id=wallet.user_id,
        currency=wallet.currency,
        balance=float(wallet.balance),
        is_frozen=wallet.is_frozen
    )


@router.post("/onepay/create-qr", response_model=OnePayQRResponse)
def create_onepay_qr(
    req: OnePayQRRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates BCEL OnePay / Lao QR payload and SVG data URI for mobile scan.
    """
    ref_code = f"BCEL-{int(req.amount)}-{secrets.token_hex(4).upper()}"
    # Standard Lao QR formatted payload representation
    qr_payload = f"00020101021229370016la.bcel.onepay0113{current_user.phone_number}54{int(req.amount)}534185802LA62150511{ref_code}6304D1B4"

    # Minimal inline SVG QR code mock for instant crisp rendering
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" fill="#ffffff" rx="12"/>
        <!-- QR Positioning Squares -->
        <rect x="20" y="20" width="45" height="45" fill="#0c2340"/>
        <rect x="28" y="28" width="29" height="29" fill="#ffffff"/>
        <rect x="35" y="35" width="15" height="15" fill="#0072ce"/>
        
        <rect x="135" y="20" width="45" height="45" fill="#0c2340"/>
        <rect x="143" y="28" width="29" height="29" fill="#ffffff"/>
        <rect x="150" y="35" width="15" height="15" fill="#0072ce"/>

        <rect x="20" y="135" width="45" height="45" fill="#0c2340"/>
        <rect x="28" y="143" width="29" height="29" fill="#ffffff"/>
        <rect x="35" y="150" width="15" height="15" fill="#0072ce"/>
        
        <!-- Center Emblem -->
        <circle cx="100" cy="100" r="18" fill="#e31b23"/>
        <text x="100" y="105" font-family="Arial" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">BCEL</text>
        
        <!-- Simulated Matrix dots -->
        <rect x="75" y="30" width="8" height="8" fill="#0c2340"/>
        <rect x="90" y="45" width="8" height="8" fill="#0c2340"/>
        <rect x="105" y="30" width="8" height="8" fill="#0c2340"/>
        <rect x="75" y="70" width="8" height="8" fill="#0c2340"/>
        <rect x="120" y="70" width="8" height="8" fill="#0c2340"/>
        <rect x="80" y="135" width="8" height="8" fill="#0c2340"/>
        <rect x="100" y="145" width="8" height="8" fill="#0c2340"/>
        <rect x="135" y="130" width="8" height="8" fill="#0c2340"/>
        <rect x="155" y="150" width="8" height="8" fill="#0c2340"/>
    </svg>"""

    import base64
    b64_svg = base64.b64encode(svg.encode("utf-8")).decode("utf-8")
    data_uri = f"data:image/svg+xml;base64,{b64_svg}"

    return OnePayQRResponse(
        qr_payload=qr_payload,
        payment_ref=ref_code,
        amount=req.amount,
        currency="LAK",
        expires_in_seconds=600,
        qr_image_data_uri=data_uri
    )


@router.post("/onepay/confirm")
def confirm_onepay_topup(
    req: TopupConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirms simulated BCEL OnePay payment and credits user wallet with double-entry ledger.
    """
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet not found.")

    amount = Decimal(str(req.amount))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Deposit amount must be positive.")

    # Execute double-entry bank deposit
    LedgerService.process_bank_deposit(
        db=db,
        wallet_id=wallet.wallet_id,
        amount=amount,
        payment_ref=req.payment_ref
    )
    db.commit()
    db.refresh(wallet)

    return {
        "success": True,
        "payment_ref": req.payment_ref,
        "amount_deposited": float(amount),
        "new_balance": float(wallet.balance),
        "narration": f"Deposited {float(amount):,.0f} LAK into wallet."
    }


@router.get("/statement")
def get_statement(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch double-entry transaction ledger statement."""
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    if not wallet:
        return []

    entries = db.query(LedgerEntry).filter(LedgerEntry.wallet_id == wallet.wallet_id).order_by(LedgerEntry.created_at.desc()).limit(50).all()
    return [
        {
            "entry_id": e.entry_id,
            "entry_type": e.entry_type,
            "amount": float(e.amount),
            "reference_type": e.reference_type,
            "narration": e.narration,
            "created_at": e.created_at.strftime("%Y-%m-%d %H:%M:%S")
        } for e in entries
    ]

@router.post("/bank/link")
def link_bank_account(
    req: LinkBankRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Link a bank account for withdrawals."""
    bank = LinkedBank(
        bank_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        bank_name=req.bank_name,
        account_name=req.account_name,
        account_number=req.account_number
    )
    db.add(bank)
    db.commit()
    return {"success": True, "bank_id": bank.bank_id, "message": "Bank account linked successfully."}

@router.post("/withdraw")
def request_withdrawal(
    req: WithdrawalRequestPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request a withdrawal to a linked bank account."""
    if current_user.kyc_status != "VERIFIED":
        raise HTTPException(status_code=403, detail="KYC verification required for withdrawals.")
        
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    if not wallet or float(wallet.balance) < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance.")
        
    bank = db.query(LinkedBank).filter(LinkedBank.bank_id == req.bank_id, LinkedBank.user_id == current_user.user_id).first()
    if not bank:
        raise HTTPException(status_code=400, detail="Linked bank account not found.")
        
    # Create withdrawal request
    w_req = WithdrawalRequest(
        request_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        bank_id=req.bank_id,
        amount=Decimal(str(req.amount)),
        status="PENDING"
    )
    db.add(w_req)
    
    # Freeze the amount in the wallet by debiting it (Pending state)
    LedgerService.process_withdrawal_hold(
        db=db,
        wallet_id=wallet.wallet_id,
        amount=Decimal(str(req.amount)),
        request_id=w_req.request_id
    )
    
    db.commit()
    return {"success": True, "request_id": w_req.request_id, "message": "Withdrawal request submitted."}
