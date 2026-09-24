import uuid
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User
from app.models.lottery import Animal, DrawPeriod, Ticket, TicketItem
from app.models.finance import Wallet
from app.schemas.lottery import (
    AnimalSchema, DrawPeriodSchema, BuyTicketRequest,
    TicketResponse, TicketItemResponse, DrawResultSubmitRequest
)
from app.services.lottery_service import LotteryEngine, LAO_ANIMALS
from app.services.ledger_service import LedgerService

router = APIRouter(prefix="/lottery", tags=["Lao Lottery Operations"])


@router.get("/animals", response_model=List[AnimalSchema])
def get_animals(db: Session = Depends(get_db)):
    """Retrieve 40 official Lao animal numbers."""
    animals = db.query(Animal).order_by(Animal.animal_id).all()
    if not animals:
        # Populate from service if empty
        for item in LAO_ANIMALS:
            a = Animal(
                animal_id=item["id"],
                animal_name_lo=item["name_lo"],
                animal_name_en=item["name_en"],
                base_number=item["base"],
                related_numbers=item["related"],
                icon_symbol=item["icon"]
            )
            db.add(a)
        db.commit()
        animals = db.query(Animal).order_by(Animal.animal_id).all()

    return [
        AnimalSchema(
            animal_id=a.animal_id,
            animal_name_lo=a.animal_name_lo,
            animal_name_en=a.animal_name_en,
            base_number=a.base_number,
            related_numbers=a.related_numbers,
            icon_symbol=a.icon_symbol
        ) for a in animals
    ]


@router.get("/draws", response_model=List[DrawPeriodSchema])
def get_draw_periods(db: Session = Depends(get_db)):
    """Fetch current open draw and historical draws."""
    draws = db.query(DrawPeriod).order_by(DrawPeriod.draw_date.desc()).all()
    if not draws:
        # Ensure default open draw exists
        today = date.today()
        # Find next Monday, Wednesday or Friday
        active_draw = DrawPeriod(
            period_id=str(uuid.uuid4()),
            period_code=f"DRAW-{today.strftime('%Y%m%d')}-01",
            draw_date=today,
            status="OPEN"
        )
        db.add(active_draw)

        # Historical simulated draw
        past_date = today - timedelta(days=2)
        past_draw = DrawPeriod(
            period_id=str(uuid.uuid4()),
            period_code=f"DRAW-{past_date.strftime('%Y%m%d')}-01",
            draw_date=past_date,
            status="DRAWN",
            winning_number_6="582914",
            winning_animal_id=14
        )
        db.add(past_draw)
        db.commit()
        draws = db.query(DrawPeriod).order_by(DrawPeriod.draw_date.desc()).all()

    results = []
    for d in draws:
        animal_name = None
        if d.winning_animal_id:
            an = LotteryEngine.get_animal_by_id(d.winning_animal_id)
            if an:
                animal_name = f"{an['name_lo']} ({an['icon']})"

        results.append(DrawPeriodSchema(
            period_id=d.period_id,
            period_code=d.period_code,
            draw_date=str(d.draw_date),
            draw_time=str(d.draw_time),
            status=d.status,
            winning_number_6=d.winning_number_6,
            winning_animal_id=d.winning_animal_id,
            winning_animal_name=animal_name
        ))
    return results


@router.get("/quick-pick")
def quick_pick_number(digits: int = 2):
    """Generates random lucky number."""
    if digits < 1 or digits > 6:
        raise HTTPException(status_code=400, detail="Digits must be between 1 and 6.")
    return {"number": LotteryEngine.generate_random_digits(digits), "digits": digits}


@router.post("/buy", response_model=TicketResponse)
def buy_ticket(
    req: BuyTicketRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Purchases lottery ticket with selected items.
    Enforces double-entry ledger deduction on wallet.
    """
    # Verify draw period
    period = db.query(DrawPeriod).filter(DrawPeriod.period_id == req.period_id).first()
    if not period or period.status != "OPEN":
        raise HTTPException(status_code=400, detail="Draw period is closed or invalid.")

    if not req.items:
        raise HTTPException(status_code=400, detail="No lottery numbers selected.")

    # Calculate total
    total_amount = Decimal("0.00")
    for item in req.items:
        total_amount += Decimal(str(item.bet_amount))

    # Fetch wallet
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).first()
    if not wallet:
        raise HTTPException(status_code=400, detail="Wallet not initialized.")

    ticket_id = str(uuid.uuid4())
    ticket_serial = LotteryEngine.generate_serial()

    # Deduct wallet balance via double-entry ledger
    try:
        LedgerService.process_ticket_purchase(
            db=db,
            wallet_id=wallet.wallet_id,
            total_cost=total_amount,
            ticket_id=ticket_id
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # Create ticket record
    new_ticket = Ticket(
        ticket_id=ticket_id,
        ticket_serial=ticket_serial,
        barcode=ticket_serial.replace("-", ""),
        user_id=current_user.user_id,
        period_id=period.period_id,
        total_amount=total_amount,
        status="PENDING",
        payment_ref="WALLET_PAID"
    )
    db.add(new_ticket)

    # Insert items
    response_items = []
    for it in req.items:
        multiplier = LotteryEngine.get_multiplier(it.bet_type)
        bet_amt = Decimal(str(it.bet_amount))
        potential = bet_amt * multiplier
        item_id = str(uuid.uuid4())

        t_item = TicketItem(
            item_id=item_id,
            ticket_id=ticket_id,
            bet_type=it.bet_type,
            chosen_number=it.chosen_number,
            chosen_animal_id=it.chosen_animal_id,
            bet_amount=bet_amt,
            multiplier=multiplier,
            potential_win=potential,
            actual_win=Decimal("0.00"),
            is_win=False
        )
        db.add(t_item)
        response_items.append(TicketItemResponse(
            item_id=item_id,
            bet_type=it.bet_type,
            chosen_number=it.chosen_number,
            chosen_animal_id=it.chosen_animal_id,
            bet_amount=float(bet_amt),
            multiplier=float(multiplier),
            potential_win=float(potential),
            actual_win=0.0,
            is_win=False
        ))

    db.commit()
    db.refresh(new_ticket)

    return TicketResponse(
        ticket_id=new_ticket.ticket_id,
        ticket_serial=new_ticket.ticket_serial,
        barcode=new_ticket.barcode,
        user_id=new_ticket.user_id,
        period_code=period.period_code,
        draw_date=str(period.draw_date),
        draw_time=str(period.draw_time),
        total_amount=float(new_ticket.total_amount),
        total_won_amount=float(new_ticket.total_won_amount),
        status=new_ticket.status,
        created_at=new_ticket.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        items=response_items
    )


@router.get("/tickets", response_model=List[TicketResponse])
def get_user_tickets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetches all tickets for authenticated player."""
    tickets = db.query(Ticket).filter(Ticket.user_id == current_user.user_id).order_by(Ticket.created_at.desc()).all()
    out = []
    for t in tickets:
        items = [
            TicketItemResponse(
                item_id=it.item_id,
                bet_type=it.bet_type,
                chosen_number=it.chosen_number,
                chosen_animal_id=it.chosen_animal_id,
                bet_amount=float(it.bet_amount),
                multiplier=float(it.multiplier),
                potential_win=float(it.potential_win),
                actual_win=float(it.actual_win),
                is_win=it.is_win
            ) for it in t.items
        ]
        out.append(TicketResponse(
            ticket_id=t.ticket_id,
            ticket_serial=t.ticket_serial,
            barcode=t.barcode,
            user_id=t.user_id,
            period_code=t.period.period_code if t.period else "N/A",
            draw_date=str(t.period.draw_date) if t.period else "",
            draw_time=str(t.period.draw_time) if t.period else "",
            total_amount=float(t.total_amount),
            total_won_amount=float(t.total_won_amount),
            status=t.status,
            created_at=t.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            items=items
        ))
    return out


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket_detail(ticket_id: str, db: Session = Depends(get_db)):
    """Fetch digital ticket slip by ID or Serial number."""
    ticket = db.query(Ticket).filter((Ticket.ticket_id == ticket_id) | (Ticket.ticket_serial == ticket_id)).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    items = [
        TicketItemResponse(
            item_id=it.item_id,
            bet_type=it.bet_type,
            chosen_number=it.chosen_number,
            chosen_animal_id=it.chosen_animal_id,
            bet_amount=float(it.bet_amount),
            multiplier=float(it.multiplier),
            potential_win=float(it.potential_win),
            actual_win=float(it.actual_win),
            is_win=it.is_win
        ) for it in ticket.items
    ]

    return TicketResponse(
        ticket_id=ticket.ticket_id,
        ticket_serial=ticket.ticket_serial,
        barcode=ticket.barcode,
        user_id=ticket.user_id,
        period_code=ticket.period.period_code if ticket.period else "N/A",
        draw_date=str(ticket.period.draw_date) if ticket.period else "",
        draw_time=str(ticket.period.draw_time) if ticket.period else "",
        total_amount=float(ticket.total_amount),
        total_won_amount=float(ticket.total_won_amount),
        status=ticket.status,
        created_at=ticket.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        items=items
    )


@router.post("/draws/draw-result")
def submit_draw_result(
    req: DrawResultSubmitRequest,
    current_user: User = Depends(require_role("Admin", "Auditor")),
    db: Session = Depends(get_db)
):
    """
    Submits winning draw result (Admin/Auditor only).
    Evaluates all tickets, updates prize statuses, and credits winners via double-entry ledger.
    """
    period = db.query(DrawPeriod).filter(DrawPeriod.period_id == req.period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Draw period not found.")

    winning_digits = req.winning_number_6.strip()
    if len(winning_digits) != 6 or not winning_digits.isdigit():
        raise HTTPException(status_code=400, detail="Winning number must be exactly 6 digits.")

    # Update draw
    period.winning_number_6 = winning_digits
    period.winning_animal_id = req.winning_animal_id
    period.status = "DRAWN"
    period.drawn_at = datetime.utcnow()

    # Evaluate pending tickets for this period
    pending_tickets = db.query(Ticket).filter(Ticket.period_id == period.period_id).all()
    winners_count = 0
    total_payout = Decimal("0.00")

    for t in pending_tickets:
        ticket_won_total = Decimal("0.00")
        has_win = False

        for it in t.items:
            res = LotteryEngine.evaluate_item(
                winning_6_digits=winning_digits,
                bet_type=it.bet_type,
                chosen_number=it.chosen_number,
                bet_amount=Decimal(str(it.bet_amount)),
                multiplier=Decimal(str(it.multiplier))
            )
            it.is_win = res["is_win"]
            it.actual_win = res["actual_win"]
            if res["is_win"]:
                has_win = True
                ticket_won_total += res["actual_win"]

        if has_win and ticket_won_total > 0:
            t.status = "WON"
            t.total_won_amount = ticket_won_total
            winners_count += 1
            total_payout += ticket_won_total

            # Process payout to winner's wallet via Double-Entry Ledger
            winner_wallet = db.query(Wallet).filter(Wallet.user_id == t.user_id).first()
            if winner_wallet:
                LedgerService.process_prize_payout(
                    db=db,
                    wallet_id=winner_wallet.wallet_id,
                    prize_amount=ticket_won_total,
                    ticket_id=t.ticket_id
                )
        else:
            t.status = "LOST"
            t.total_won_amount = Decimal("0.00")

    db.commit()

    return {
        "period_code": period.period_code,
        "winning_number_6": period.winning_number_6,
        "tickets_evaluated": len(pending_tickets),
        "winners_count": winners_count,
        "total_prize_payout_lak": float(total_payout)
    }
