import type { AdminDigitRule, CreateDrawBody, Digits } from '../api/types';
import { zonedLocalToUtcIso } from './datetime';

export const ALL_DIGITS: Digits[] = [2, 3, 4, 5, 6];

/**
 * Starting values for a new draw's rules. They are only suggestions shown in the form;
 * the admin reviews and edits them before saving. Amounts in kip.
 */
export const DEFAULT_RULES: AdminDigitRule[] = [
  { digits: 2, payoutRate: 60, minAmount: 1000, maxPerLine: 100000, defaultNumberCap: 1000000 },
  { digits: 3, payoutRate: 500, minAmount: 1000, maxPerLine: 50000, defaultNumberCap: 200000 },
  { digits: 4, payoutRate: 3000, minAmount: 1000, maxPerLine: 20000, defaultNumberCap: 50000 },
  { digits: 5, payoutRate: 20000, minAmount: 1000, maxPerLine: 10000, defaultNumberCap: 10000 },
  { digits: 6, payoutRate: 100000, minAmount: 1000, maxPerLine: 5000, defaultNumberCap: 5000 },
];

/** "0123" -> "0124" (keeps zero padding); non-numeric -> "". */
export function nextDrawNo(previous: string | null | undefined): string {
  if (!previous || !/^\d+$/.test(previous)) return '';
  const next = String(Number(previous) + 1);
  return next.padStart(previous.length, '0');
}

export interface RuleRow {
  digits: Digits;
  enabled: boolean;
  payoutRate: string;
  minAmount: string;
  maxPerLine: string;
  defaultNumberCap: string;
}

export interface DrawFormValues {
  drawNo: string;
  drawDate: string; // YYYY-MM-DD
  salesOpenLocal: string; // datetime-local, Asia/Vientiane
  salesCloseLocal: string; // datetime-local, Asia/Vientiane
  rules: RuleRow[];
}

export type DrawFormErrors = Partial<Record<'drawNo' | 'drawDate' | 'salesOpen' | 'salesClose' | 'rules', string>> & {
  ruleRows?: Partial<Record<Digits, string>>;
};

export function defaultRuleRows(): RuleRow[] {
  return DEFAULT_RULES.map((r) => ({
    digits: r.digits,
    enabled: true,
    payoutRate: String(r.payoutRate),
    minAmount: String(r.minAmount),
    maxPerLine: String(r.maxPerLine),
    defaultNumberCap: String(r.defaultNumberCap),
  }));
}

const posInt = (s: string): number | null => {
  const t = s.replace(/[\s,]/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
};

const posRate = (s: string): number | null => {
  const t = s.replace(/[\s,]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
};

/** Validate the create-draw form and build the API body (times converted Vientiane -> UTC). */
export function buildCreateDrawBody(v: DrawFormValues): { body?: CreateDrawBody; errors: DrawFormErrors } {
  const errors: DrawFormErrors = {};
  const drawNo = v.drawNo.trim();
  if (!drawNo) errors.drawNo = 'ກະລຸນາໃສ່ເລກງວດ';
  else if (!/^[A-Za-z0-9-]{1,20}$/.test(drawNo)) errors.drawNo = 'ເລກງວດໃຊ້ໄດ້ສະເພາະ A-Z, 0-9 ແລະ - (ບໍ່ເກີນ 20 ໂຕ)';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.drawDate)) errors.drawDate = 'ກະລຸນາເລືອກວັນອອກຫວຍ';

  const openIso = zonedLocalToUtcIso(v.salesOpenLocal);
  const closeIso = zonedLocalToUtcIso(v.salesCloseLocal);
  if (!openIso) errors.salesOpen = 'ກະລຸນາໃສ່ເວລາເປີດຂາຍ';
  if (!closeIso) errors.salesClose = 'ກະລຸນາໃສ່ເວລາປິດຂາຍ';
  if (openIso && closeIso && Date.parse(closeIso) <= Date.parse(openIso)) {
    errors.salesClose = 'ເວລາປິດຂາຍຕ້ອງຫຼັງເວລາເປີດຂາຍ';
  } else if (closeIso && !errors.drawDate && v.salesCloseLocal.slice(0, 10) > v.drawDate) {
    errors.salesClose = 'ເວລາປິດຂາຍຕ້ອງບໍ່ຫຼັງວັນອອກຫວຍ';
  }

  const rules: AdminDigitRule[] = [];
  const ruleRows: Partial<Record<Digits, string>> = {};
  for (const row of v.rules) {
    if (!row.enabled) continue;
    const payoutRate = posRate(row.payoutRate);
    const minAmount = posInt(row.minAmount);
    const maxPerLine = posInt(row.maxPerLine);
    const defaultNumberCap = posInt(row.defaultNumberCap);
    if (payoutRate === null || minAmount === null || maxPerLine === null || defaultNumberCap === null) {
      ruleRows[row.digits] = 'ຕ້ອງເປັນຕົວເລກຫຼາຍກວ່າ 0';
      continue;
    }
    if (minAmount > maxPerLine) {
      ruleRows[row.digits] = 'ຂັ້ນຕ່ຳຕ້ອງບໍ່ເກີນສູງສຸດຕໍ່ແຖວ';
      continue;
    }
    if (maxPerLine > defaultNumberCap) {
      ruleRows[row.digits] = 'ສູງສຸດຕໍ່ແຖວຕ້ອງບໍ່ເກີນເພດານຕໍ່ເລກ';
      continue;
    }
    rules.push({ digits: row.digits, payoutRate, minAmount, maxPerLine, defaultNumberCap });
  }
  if (Object.keys(ruleRows).length) errors.ruleRows = ruleRows;
  if (!v.rules.some((r) => r.enabled)) errors.rules = 'ຕ້ອງເປີດຂາຍຢ່າງໜ້ອຍ 1 ປະເພດ';

  const hasErrors = Object.keys(errors).length > 0;
  if (hasErrors || !openIso || !closeIso) return { errors };
  return {
    errors,
    body: { drawNo, drawDate: v.drawDate, salesOpenAt: openIso, salesCloseAt: closeIso, rules },
  };
}
