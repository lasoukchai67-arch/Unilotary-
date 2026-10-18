// ທຸກການເຄື່ອນໄຫວເງິນໃນກະເປົາຜ່ານຟັງຊັນນີ້: ອັບເດດຍອດ + ບັນທຶກ ledger ໃນ transaction ດຽວກັນ.
// idempotencyKey ຊ້ຳ → ບໍ່ເຮັດຊ້ຳ ແລະ ສົ່ງ null ກັບ.
import type pg from 'pg';
import { AppError } from './errors.js';

type TxType = 'deposit' | 'withdraw' | 'purchase' | 'payout' | 'refund' | 'commission' | 'adjust';

export interface LedgerEntry {
  userId: number;
  type: TxType;
  amount: number; // +ເຂົ້າ / -ອອກ
  refType: string;
  refId: number;
  idempotencyKey: string;
  note?: string;
  /** ສຳລັບການຖອນ: ຍ້າຍເງິນທີ່ຫັກໄປໄວ້ໃນ held */
  holdDelta?: number;
}

export async function postLedger(c: pg.PoolClient, e: LedgerEntry): Promise<{ balance: number } | null> {
  const { rows: dup } = await c.query('SELECT 1 FROM wallet_transactions WHERE idempotency_key = $1', [e.idempotencyKey]);
  if (dup[0]) return null;

  const { rows } = await c.query(
    'SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE',
    [e.userId],
  );
  const w = rows[0];
  if (!w) throw new AppError('NOT_FOUND', 'ບໍ່ພົບກະເປົາເງິນ');
  if (w.balance + e.amount < 0) throw new AppError('INSUFFICIENT_BALANCE', 'ເງິນໃນກະເປົາບໍ່ພໍ', { balance: w.balance });

  const { rows: upd } = await c.query(
    'UPDATE wallets SET balance = balance + $1, held = held + $2, updated_at = now() WHERE id = $3 RETURNING balance',
    [e.amount, e.holdDelta ?? 0, w.id],
  );
  await c.query(
    `INSERT INTO wallet_transactions (wallet_id, type, amount, balance_after, ref_type, ref_id, idempotency_key, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [w.id, e.type, e.amount, upd[0].balance, e.refType, e.refId, e.idempotencyKey, e.note ?? null],
  );
  return { balance: upd[0].balance };
}
