"""
Double-Entry General Ledger Service
Enforces Section 4.3: Double-Entry Financial Engine with atomic transaction groups.
RULE: Every financial event must have balancing DEBIT and CREDIT entries: SUM(DEBIT) == SUM(CREDIT).
"""

import uuid
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text


class LedgerService:
    @staticmethod
    def execute_transaction_group(
        db: Session,
        entries: List[Dict[str, Any]],
        reference_type: str,
        reference_id: Optional[uuid.UUID],
        narration: str
    ) -> uuid.UUID:
        """
        Records a set of ledger entries ensuring total DEBIT equals total CREDIT.
        """
        transaction_group_id = uuid.uuid4()
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for item in entries:
            amt = Decimal(str(item["amount"]))
            direction = item["entry_type"].upper()
            if direction == "DEBIT":
                total_debit += amt
            elif direction == "CREDIT":
                total_credit += amt
            else:
                raise ValueError(f"Invalid entry direction: {direction}")

        if total_debit != total_credit:
            raise ValueError(f"Ledger Imbalance! DEBIT({total_debit}) != CREDIT({total_credit})")

        # Persist ledger entries
        for item in entries:
            entry_id = uuid.uuid4()
            amt = Decimal(str(item["amount"]))
            db.execute(
                text("""
                    INSERT INTO finance.ledger_entries 
                    (entry_id, transaction_group_id, wallet_id, account_name, entry_type, amount, reference_type, reference_id, narration)
                    VALUES (:eid, :gid, :wid, :acc, :etype, :amt, :reftype, :refid, :narration)
                """),
                {
                    "eid": entry_id,
                    "gid": transaction_group_id,
                    "wid": item.get("wallet_id"),
                    "acc": item["account_name"],
                    "etype": item["entry_type"].upper(),
                    "amt": amt,
                    "reftype": reference_type,
                    "refid": reference_id,
                    "narration": narration
                }
            )

        return transaction_group_id

    @classmethod
    def process_ticket_purchase(
        cls,
        db: Session,
        wallet_id: uuid.UUID,
        total_cost: Decimal,
        ticket_id: uuid.UUID
    ) -> uuid.UUID:
        """
        Debits User Wallet and Credits Lottery Revenue Pool.
        """
        # Lock and check wallet balance
        wallet_row = db.execute(
            text("SELECT balance, is_frozen FROM finance.wallets WHERE wallet_id = :wid FOR UPDATE"),
            {"wid": wallet_id}
        ).fetchone()

        if not wallet_row:
            raise ValueError("Wallet not found.")
        if wallet_row[1]:
            raise ValueError("Wallet is currently frozen.")
        if wallet_row[0] < total_cost:
            raise ValueError(f"Insufficient funds. Required: {total_cost} LAK, Current: {wallet_row[0]} LAK")

        # Deduct wallet balance
        db.execute(
            text("UPDATE finance.wallets SET balance = balance - :amt, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = :wid"),
            {"amt": total_cost, "wid": wallet_id}
        )

        # Balanced Double-Entry
        entries = [
            {
                "wallet_id": wallet_id,
                "account_name": "USER_WALLET",
                "entry_type": "DEBIT",
                "amount": total_cost
            },
            {
                "wallet_id": None,
                "account_name": "LOTTERY_SALES_REVENUE",
                "entry_type": "CREDIT",
                "amount": total_cost
            }
        ]
        return cls.execute_transaction_group(
            db, entries, reference_type="TICKET_PURCHASE", reference_id=ticket_id, narration=f"Ticket purchase #{ticket_id}"
        )

    @classmethod
    def process_prize_payout(
        cls,
        db: Session,
        wallet_id: uuid.UUID,
        prize_amount: Decimal,
        ticket_id: uuid.UUID
    ) -> uuid.UUID:
        """
        Debits Prize Expense Pool and Credits User Wallet.
        """
        # Add to wallet balance
        db.execute(
            text("UPDATE finance.wallets SET balance = balance + :amt, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = :wid"),
            {"amt": prize_amount, "wid": wallet_id}
        )

        entries = [
            {
                "wallet_id": None,
                "account_name": "PRIZE_POOL_EXPENSE",
                "entry_type": "DEBIT",
                "amount": prize_amount
            },
            {
                "wallet_id": wallet_id,
                "account_name": "USER_WALLET",
                "entry_type": "CREDIT",
                "amount": prize_amount
            }
        ]
        return cls.execute_transaction_group(
            db, entries, reference_type="PRIZE_PAYOUT", reference_id=ticket_id, narration=f"Prize payout for ticket #{ticket_id}"
        )

    @classmethod
    def process_bank_deposit(
        cls,
        db: Session,
        wallet_id: uuid.UUID,
        amount: Decimal,
        payment_ref: str
    ) -> uuid.UUID:
        """
        Credits User Wallet and Debits BCEL Settlement Clearing Account.
        """
        db.execute(
            text("UPDATE finance.wallets SET balance = balance + :amt, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = :wid"),
            {"amt": amount, "wid": wallet_id}
        )

        entries = [
            {
                "wallet_id": None,
                "account_name": "BCEL_ONE_CLEARING",
                "entry_type": "DEBIT",
                "amount": amount
            },
            {
                "wallet_id": wallet_id,
                "account_name": "USER_WALLET",
                "entry_type": "CREDIT",
                "amount": amount
            }
        ]
        return cls.execute_transaction_group(
            db, entries, reference_type="BANK_DEPOSIT", reference_id=None, narration=f"BCEL One Topup Ref: {payment_ref}"
        )

    @classmethod
    def process_withdrawal_hold(
        cls,
        db: Session,
        wallet_id: str,
        amount: Decimal,
        request_id: str
    ) -> uuid.UUID:
        """
        Debits User Wallet and Credits Bank Withdrawal Payable (Hold).
        """
        # Deduct wallet balance
        db.execute(
            text("UPDATE finance.wallets SET balance = balance - :amt, updated_at = CURRENT_TIMESTAMP WHERE wallet_id = :wid"),
            {"amt": amount, "wid": wallet_id}
        )

        # Balanced Double-Entry
        entries = [
            {
                "wallet_id": wallet_id,
                "account_name": "USER_WALLET",
                "entry_type": "DEBIT",
                "amount": amount
            },
            {
                "wallet_id": None,
                "account_name": "BANK_WITHDRAWAL_PAYABLE",
                "entry_type": "CREDIT",
                "amount": amount
            }
        ]
        return cls.execute_transaction_group(
            db, entries, reference_type="BANK_WITHDRAWAL", reference_id=request_id, narration=f"Bank Withdrawal Request #{request_id}"
        )
