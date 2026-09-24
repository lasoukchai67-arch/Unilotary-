"""
Legacy Data Ingestion & Migration Pipeline (ETL)
Enforces RULE 3: Legacy data is strictly loaded into 'staging' schema before migration to 'production'.
"""

import sys
import uuid
import logging
from typing import Dict, Any
import pandas as pd
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class LegacyLotteryETL:
    def __init__(self, db_uri: str):
        self.engine = create_engine(db_uri)

    def extract_from_csv(self, file_path: str) -> pd.DataFrame:
        """Extract legacy CSV/Excel records into a Pandas DataFrame."""
        logger.info(f"Extracting legacy data from {file_path}")
        df = pd.read_csv(file_path, dtype=str)
        # Required legacy columns normalization
        required_cols = ["legacy_ticket_no", "phone_number", "draw_date", "number_bought", "amount_lak"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Missing mandatory column: {col}")
        return df

    def stage_legacy_records(self, df: pd.DataFrame) -> int:
        """
        Stage raw data into staging.legacy_raw_tickets.
        Zero mutation on production tables during staging phase.
        """
        logger.info(f"Staging {len(df)} records into staging.legacy_raw_tickets")
        staged_df = df.copy()
        staged_df["migration_status"] = "PENDING"
        staged_df["raw_payload"] = staged_df.to_json(orient="records", lines=False)

        # Write to staging schema
        staged_df.to_sql(
            name="legacy_raw_tickets",
            schema="staging",
            con=self.engine,
            if_exists="append",
            index=False
        )
        return len(staged_df)

    def validate_and_migrate_to_production(self) -> Dict[str, int]:
        """
        Cleanse, validate and migrate records from staging to production (lottery schema).
        Enforces atomicity and referential integrity.
        """
        logger.info("Executing staging to production migration pipeline...")
        success_count = 0
        failure_count = 0

        with self.engine.begin() as conn:
            # Fetch pending staging items
            rows = conn.execute(
                text("SELECT staging_id, legacy_ticket_no, phone_number, draw_date, number_bought, amount_lak "
                     "FROM staging.legacy_raw_tickets WHERE migration_status = 'PENDING' FOR UPDATE")
            ).fetchall()

            for row in rows:
                staging_id, legacy_ticket_no, phone, draw_date, number_bought, amount_str = row
                try:
                    # Sanitize and validate
                    clean_phone = phone.strip().replace(" ", "").replace("+856", "0")
                    clean_number = number_bought.strip()
                    amount_lak = float(amount_str.replace(",", "").strip())
                    if amount_lak <= 0 or len(clean_number) > 6 or not clean_number.isdigit():
                        raise ValueError(f"Invalid payload values: amount={amount_lak}, number={clean_number}")

                    # Determine or ensure user exists
                    user_res = conn.execute(
                        text("SELECT user_id FROM security.users WHERE phone_number = :p"),
                        {"p": clean_phone}
                    ).fetchone()
                    if not user_res:
                        new_user_id = uuid.uuid4()
                        conn.execute(
                            text("INSERT INTO security.users (user_id, phone_number, full_name, pin_hash, role) "
                                 "VALUES (:id, :p, :name, :pin, 'Player')"),
                            {"id": new_user_id, "p": clean_phone, "name": f"User {clean_phone[-4:]}", "pin": "STAGED_MIGRATED"}
                        )
                        # Create wallet
                        conn.execute(
                            text("INSERT INTO finance.wallets (wallet_id, user_id, balance) VALUES (:wid, :uid, 0.00)"),
                            {"wid": uuid.uuid4(), "uid": new_user_id}
                        )
                        user_id = new_user_id
                    else:
                        user_id = user_res[0]

                    # Ensure draw period exists
                    period_res = conn.execute(
                        text("SELECT period_id FROM lottery.draw_periods WHERE draw_date = :d"),
                        {"d": draw_date}
                    ).fetchone()
                    if not period_res:
                        period_id = uuid.uuid4()
                        period_code = f"DRAW-{draw_date.replace('-', '')}"
                        conn.execute(
                            text("INSERT INTO lottery.draw_periods (period_id, period_code, draw_date, status) "
                                 "VALUES (:pid, :pcode, :d, 'CLOSED')"),
                            {"pid": period_id, "pcode": period_code, "d": draw_date}
                        )
                    else:
                        period_id = period_res[0]

                    # Insert migrated ticket
                    ticket_id = uuid.uuid4()
                    ticket_serial = f"LEGACY-{legacy_ticket_no}-{ticket_id.hex[:6].upper()}"
                    conn.execute(
                        text("""
                            INSERT INTO lottery.tickets 
                            (ticket_id, ticket_serial, barcode, user_id, period_id, total_amount, status)
                            VALUES (:tid, :serial, :bar, :uid, :pid, :amt, 'PENDING')
                        """),
                        {"tid": ticket_id, "serial": ticket_serial, "bar": ticket_serial, "uid": user_id, "pid": period_id, "amt": amount_lak}
                    )

                    # Insert ticket item
                    digit_count = len(clean_number)
                    bet_type = f"DIGIT_{digit_count}"
                    multiplier = {1: 8.5, 2: 60.0, 3: 500.0, 4: 6000.0, 5: 40000.0, 6: 400000.0}.get(digit_count, 1.0)
                    conn.execute(
                        text("""
                            INSERT INTO lottery.ticket_items 
                            (item_id, ticket_id, bet_type, chosen_number, bet_amount, multiplier, potential_win)
                            VALUES (:iid, :tid, :btype, :num, :amt, :mult, :pot)
                        """),
                        {
                            "iid": uuid.uuid4(),
                            "tid": ticket_id,
                            "btype": bet_type,
                            "num": clean_number,
                            "amt": amount_lak,
                            "mult": multiplier,
                            "pot": amount_lak * multiplier
                        }
                    )

                    # Update staging status to MIGRATED
                    conn.execute(
                        text("UPDATE staging.legacy_raw_tickets SET migration_status = 'MIGRATED' WHERE staging_id = :sid"),
                        {"sid": staging_id}
                    )
                    success_count += 1
                except Exception as ex:
                    logger.error(f"Failed migrating record {staging_id}: {str(ex)}")
                    conn.execute(
                        text("UPDATE staging.legacy_raw_tickets SET migration_status = 'FAILED', error_message = :err WHERE staging_id = :sid"),
                        {"err": str(ex), "sid": staging_id}
                    )
                    failure_count += 1

        logger.info(f"Migration finished. Success: {success_count}, Failures: {failure_count}")
        return {"success": success_count, "failure": failure_count}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python etl_legacy_data.py <DB_URI> <PATH_TO_CSV>")
        sys.exit(1)
    db_conn = sys.argv[1]
    csv_file = sys.argv[2]
    etl = LegacyLotteryETL(db_conn)
    df_raw = etl.extract_from_csv(csv_file)
    etl.stage_legacy_records(df_raw)
    etl.validate_and_migrate_to_production()
