import { describe, expect, it } from 'vitest';
import type { DrawReport } from '../api/types';
import { csvCell, drawReportCsv, toCsv } from './csv';
import { buildCreateDrawBody, defaultRuleRows, type DrawFormValues, nextDrawNo } from './drawForm';
import { isValidLaoPhone, normalizePhone } from './phone';
import { can, isStaffRole } from './roles';
import { settingAsNumber, validateSettingValue } from './settings';

describe('phone numbers', () => {
  it('normalises like the API', () => {
    expect(normalizePhone('020 5555-1234')).toBe('02055551234');
    expect(normalizePhone('+8562055551234')).toBe('02055551234');
    expect(normalizePhone('85630 1234567')).toBe('0301234567');
  });
  it('validates 020 (11 digits) and 030 (10 digits)', () => {
    expect(isValidLaoPhone('02055551234')).toBe(true);
    expect(isValidLaoPhone('0301234567')).toBe(true);
    expect(isValidLaoPhone('0205555123')).toBe(false);
    expect(isValidLaoPhone('03012345678')).toBe(false);
    expect(isValidLaoPhone('0812345678')).toBe(false);
  });
});

describe('roles', () => {
  it('only admin/finance/auditor are staff', () => {
    expect(['admin', 'finance', 'auditor'].every(isStaffRole)).toBe(true);
    expect(isStaffRole('customer')).toBe(false);
    expect(isStaffRole('agent')).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
  it('finance acts on withdrawals/payouts only; auditor is read-only', () => {
    expect(can('admin', 'settings.manage')).toBe(true);
    expect(can('finance', 'withdrawals.review')).toBe(true);
    expect(can('finance', 'payouts.review')).toBe(true);
    expect(can('finance', 'kyc.review')).toBe(false);
    expect(can('finance', 'results.manage')).toBe(false);
    expect(can('finance', 'draws.manage')).toBe(false);
    for (const p of ['draws.manage', 'withdrawals.review', 'payouts.review', 'users.manage', 'settings.manage'] as const) {
      expect(can('auditor', p)).toBe(false);
    }
    expect(can('customer', 'payouts.review')).toBe(false);
  });
});

describe('create-draw form', () => {
  const values = (over: Partial<DrawFormValues> = {}): DrawFormValues => ({
    drawNo: '0124',
    drawDate: '2026-10-21',
    salesOpenLocal: '2026-10-19T08:00',
    salesCloseLocal: '2026-10-21T20:00',
    rules: defaultRuleRows(),
    ...over,
  });

  it('builds the API body with UTC times and all enabled rules', () => {
    const { body, errors } = buildCreateDrawBody(values());
    expect(errors).toEqual({});
    expect(body).toMatchObject({
      drawNo: '0124',
      drawDate: '2026-10-21',
      salesOpenAt: '2026-10-19T01:00:00.000Z',
      salesCloseAt: '2026-10-21T13:00:00.000Z',
    });
    expect(body!.rules.map((r) => r.digits)).toEqual([2, 3, 4, 5, 6]);
    expect(body!.rules[0]).toEqual({ digits: 2, payoutRate: 60, minAmount: 1000, maxPerLine: 100000, defaultNumberCap: 1000000 });
  });

  it('omits disabled digits and validates rows', () => {
    const rules = defaultRuleRows().map((r) => (r.digits === 6 ? { ...r, enabled: false } : r));
    rules[0] = { ...rules[0], minAmount: '200000' }; // > maxPerLine
    const { body, errors } = buildCreateDrawBody(values({ rules }));
    expect(body).toBeUndefined();
    expect(errors.ruleRows?.[2]).toBeTruthy();
    const ok = buildCreateDrawBody(values({ rules: defaultRuleRows().map((r) => (r.digits === 6 ? { ...r, enabled: false } : r)) }));
    expect(ok.body!.rules.map((r) => r.digits)).toEqual([2, 3, 4, 5]);
  });

  it('rejects close before open, close after the draw date, bad draw numbers and no rules', () => {
    expect(buildCreateDrawBody(values({ salesCloseLocal: '2026-10-19T07:00' })).errors.salesClose).toBeTruthy();
    expect(buildCreateDrawBody(values({ salesCloseLocal: '2026-10-22T09:00' })).errors.salesClose).toBeTruthy();
    expect(buildCreateDrawBody(values({ drawNo: 'ງວດ 1' })).errors.drawNo).toBeTruthy();
    expect(buildCreateDrawBody(values({ drawNo: '' })).errors.drawNo).toBeTruthy();
    expect(buildCreateDrawBody(values({ rules: defaultRuleRows().map((r) => ({ ...r, enabled: false })) })).errors.rules).toBeTruthy();
  });

  it('suggests the next draw number keeping zero padding', () => {
    expect(nextDrawNo('0123')).toBe('0124');
    expect(nextDrawNo('0999')).toBe('1000');
    expect(nextDrawNo('9')).toBe('10');
    expect(nextDrawNo('A-12')).toBe('');
    expect(nextDrawNo(undefined)).toBe('');
  });
});

describe('settings validation', () => {
  const all = new Map<string, unknown>([
    ['deposit_min', 10000],
    ['deposit_max', 50000000],
    ['withdraw_min', 50000],
    ['withdraw_max_daily', '100000000'],
  ]);
  it('reads numeric values', () => {
    expect(settingAsNumber(5000000)).toBe(5000000);
    expect(settingAsNumber('5000000')).toBe(5000000);
    expect(settingAsNumber({})).toBeNull();
  });
  it('keeps min <= max and positive values', () => {
    expect(validateSettingValue('deposit_min', 60000000, all)).toBeTruthy();
    expect(validateSettingValue('deposit_max', 5000, all)).toBeTruthy();
    expect(validateSettingValue('withdraw_min', 200000000, all)).toBeTruthy();
    expect(validateSettingValue('deposit_min', 20000, all)).toBeNull();
    expect(validateSettingValue('withdraw_min', 0, all)).toBeTruthy();
    expect(validateSettingValue('payout_auto_limit', 0, all)).toBeNull();
  });
});

describe('CSV', () => {
  it('escapes cells and neutralises formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(null)).toBe('');
    expect(toCsv([['a', 1], []])).toBe('a,1\r\n\r\n');
  });

  it('exports a draw report with plain integer amounts', () => {
    const report: DrawReport = {
      drawNo: '0123',
      status: 'resulted',
      resultNumber: '482175',
      sales: {
        total: 1500000,
        tickets: 42,
        byDigits: [
          { digits: 2, amount: 1000000, lines: 80 },
          { digits: 3, amount: 500000, lines: 20 },
        ],
      },
      payouts: { total: 600000, paid: 600000, pending: 0 },
      commissions: 30000,
      net: 870000,
    };
    const csv = drawReportCsv(report);
    expect(csv).toContain('ລາຍງານງວດ,0123\r\n');
    expect(csv).toContain('ເລກທີ່ອອກ,482175\r\n');
    expect(csv).toContain('ຍອດຂາຍລວມ,1500000\r\n');
    expect(csv).toContain('ກຳໄລສຸດທິ,870000\r\n');
    expect(csv).toContain('2 ໂຕ,80,1000000\r\n');
    expect(csv).toContain('3 ໂຕ,20,500000\r\n');
  });
});
