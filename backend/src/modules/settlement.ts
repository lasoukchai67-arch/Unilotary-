// ຕັດສິນຜົນງວດ: ຄິດລາງວັນທຸກແຖວ, ອັບເດດສະຖານະບິນ, ສ້າງລາຍການຈ່າຍ, ຈ່າຍອັດຕະໂນມັດສຳລັບຍອດນ້ອຍ,
// ແລະ ຈ່າຍຄ່າຄອມໃຫ້ຕົວແທນ. ທັງໝົດຢູ່ໃນ transaction ດຽວ: ລົ້ມ = ບໍ່ມີຫຍັງປ່ຽນ.
import type pg from 'pg';
import { getSetting, notify } from '../lib/audit.js';
import { postLedger } from '../lib/ledger.js';

export interface SettlementSummary {
  winners: number;
  totalWin: number;
  autoPaid: number;
  pendingPayouts: number;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export async function settleDraw(c: pg.PoolClient, drawId: number, result: string): Promise<SettlementSummary> {
  // ເລກຖືກ = ກົງກັບ N ໂຕທ້າຍຂອງຜົນ 6 ໂຕ
  await c.query(
    `UPDATE ticket_lines l SET win_amount = CASE WHEN right($2, l.digits) = l.number THEN floor(l.amount * l.payout_rate) ELSE 0 END
       FROM tickets t
      WHERE l.ticket_id = t.id AND l.draw_id = $1 AND t.status = 'active'`,
    [drawId, result],
  );
  const { rows: tickets } = await c.query(
    `UPDATE tickets t SET total_win = s.win, status = CASE WHEN s.win > 0 THEN 'won'::ticket_status ELSE 'lost'::ticket_status END
       FROM (SELECT ticket_id, SUM(win_amount)::bigint AS win FROM ticket_lines WHERE draw_id = $1 GROUP BY ticket_id) s
      WHERE t.id = s.ticket_id AND t.draw_id = $1 AND t.status = 'active'
      RETURNING t.id, t.user_id, t.ticket_no, t.total_win`,
    [drawId],
  );

  const autoLimit = Number(await getSetting(c, 'payout_auto_limit'));
  const summary: SettlementSummary = { winners: 0, totalWin: 0, autoPaid: 0, pendingPayouts: 0 };
  for (const t of tickets.filter((x) => x.total_win > 0)) {
    summary.winners++;
    summary.totalWin += t.total_win;
    const { rows: p } = await c.query(
      'INSERT INTO payouts (ticket_id, user_id, amount) VALUES ($1, $2, $3) RETURNING id',
      [t.id, t.user_id, t.total_win],
    );
    if (t.total_win <= autoLimit) {
      await payPayout(c, p[0].id, null);
      summary.autoPaid++;
    } else {
      summary.pendingPayouts++;
      await notify(c, t.user_id, 'ຍິນດີນຳ! ທ່ານຖືກລາງວັນ', `ບິນ ${t.ticket_no} ຖືກລາງວັນ ${fmt(t.total_win)} ກີບ. ຍອດໃຫຍ່ຕ້ອງກວດສອບກ່ອນໂອນ.`, {
        ticketId: t.id,
      });
    }
  }

  // ຄ່າຄອມຕົວແທນຂອງງວດນີ້ (ບໍ່ລວມບິນທີ່ຍົກເລີກ)
  const { rows: comm } = await c.query(
    `UPDATE commissions c SET settled = true FROM tickets t
      WHERE c.ticket_id = t.id AND t.draw_id = $1 AND NOT c.settled AND t.status <> 'cancelled' AND c.amount > 0
      RETURNING c.id, c.agent_id, c.amount`,
    [drawId],
  );
  for (const cm of comm) {
    await postLedger(c, {
      userId: cm.agent_id,
      type: 'commission',
      amount: cm.amount,
      refType: 'commission',
      refId: cm.id,
      idempotencyKey: `commission:${cm.id}`,
    });
  }
  return summary;
}

/** ໂອນລາງວັນເຂົ້າກະເປົາ (ໃຊ້ທັງການຈ່າຍອັດຕະໂນມັດ ແລະ ການອະນຸມັດຂອງແອັດມິນ) */
export async function payPayout(c: pg.PoolClient, payoutId: number, approvedBy: number | null): Promise<void> {
  const { rows } = await c.query(
    `UPDATE payouts p SET status = 'paid', paid_at = now(), approved_by = $2
      FROM tickets t WHERE p.id = $1 AND p.status = 'pending' AND t.id = p.ticket_id
      RETURNING p.ticket_id, p.user_id, p.amount, t.ticket_no`,
    [payoutId, approvedBy],
  );
  const p = rows[0];
  if (!p) return;
  await postLedger(c, {
    userId: p.user_id,
    type: 'payout',
    amount: p.amount,
    refType: 'ticket',
    refId: p.ticket_id,
    idempotencyKey: `payout:${p.ticket_id}`,
  });
  await c.query(`UPDATE tickets SET status = 'paid' WHERE id = $1`, [p.ticket_id]);
  await notify(c, p.user_id, 'ຍິນດີນຳ! ທ່ານຖືກລາງວັນ', `ບິນ ${p.ticket_no}: ໂອນ ${fmt(p.amount)} ກີບ ເຂົ້າກະເປົາແລ້ວ`, { ticketId: p.ticket_id });
}

/** ຍົກເລີກງວດ: ຄືນເງິນທຸກບິນທີ່ຍັງບໍ່ຕັດສິນ */
export async function refundDraw(c: pg.PoolClient, drawId: number): Promise<number> {
  const { rows } = await c.query(
    `UPDATE tickets SET status = 'cancelled' WHERE draw_id = $1 AND status = 'active'
      RETURNING id, user_id, total_amount, ticket_no`,
    [drawId],
  );
  for (const t of rows) {
    await postLedger(c, {
      userId: t.user_id,
      type: 'refund',
      amount: t.total_amount,
      refType: 'ticket',
      refId: t.id,
      idempotencyKey: `refund:ticket:${t.id}`,
      note: 'ຍົກເລີກງວດ',
    });
    await notify(c, t.user_id, 'ງວດຖືກຍົກເລີກ', `ບິນ ${t.ticket_no}: ຄືນເງິນ ${fmt(t.total_amount)} ກີບ ເຂົ້າກະເປົາແລ້ວ`, { ticketId: t.id });
  }
  return rows.length;
}
