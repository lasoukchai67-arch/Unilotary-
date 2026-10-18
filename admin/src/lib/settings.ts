import type { SettingKey } from '../api/types';

/** Settings values are JSON; the known keys hold kip amounts (numbers, possibly sent as numeric strings). */
export function settingAsNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

const MIN_MAX_PAIRS: { min: SettingKey; max: SettingKey; minTooHigh: string; maxTooLow: string }[] = [
  {
    min: 'deposit_min',
    max: 'deposit_max',
    minTooHigh: 'ເຕີມເງິນຂັ້ນຕ່ຳຕ້ອງບໍ່ເກີນເຕີມເງິນສູງສຸດ',
    maxTooLow: 'ເຕີມເງິນສູງສຸດຕ້ອງບໍ່ຕ່ຳກວ່າເຕີມເງິນຂັ້ນຕ່ຳ',
  },
  {
    min: 'withdraw_min',
    max: 'withdraw_max_daily',
    minTooHigh: 'ຖອນເງິນຂັ້ນຕ່ຳຕ້ອງບໍ່ເກີນຖອນສູງສຸດຕໍ່ມື້',
    maxTooLow: 'ຖອນສູງສຸດຕໍ່ມື້ຕ້ອງບໍ່ຕ່ຳກວ່າຖອນເງິນຂັ້ນຕ່ຳ',
  },
];

/**
 * Validate a new value: the API requires an integer >= 0 for payout_auto_limit and > 0 for the
 * others, and a minimum must never exceed its maximum. Returns a Lao error message or null.
 */
export function validateSettingValue(key: SettingKey, value: number, all: Map<string, unknown>): string | null {
  if (key !== 'payout_auto_limit' && value <= 0) return 'ຄ່ານີ້ຕ້ອງຫຼາຍກວ່າ 0';
  for (const p of MIN_MAX_PAIRS) {
    if (key === p.min) {
      const max = settingAsNumber(all.get(p.max));
      if (max !== null && value > max) return p.minTooHigh;
    } else if (key === p.max) {
      const min = settingAsNumber(all.get(p.min));
      if (min !== null && value < min) return p.maxTooLow;
    }
  }
  return null;
}
