import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatCountdown,
  formatDate,
  formatDateTime,
  todayInZone,
  utcIsoToZonedLocal,
  zonedLocalToUtcIso,
  zoneOffsetMs,
} from './datetime';

describe('Asia/Vientiane -> UTC conversion (datetime-local input -> API)', () => {
  it('runs in a non-Vientiane local zone so the test is meaningful', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe('Asia/Vientiane');
  });

  it('subtracts 7 hours', () => {
    expect(zonedLocalToUtcIso('2026-10-19T20:00')).toBe('2026-10-19T13:00:00.000Z');
    expect(zonedLocalToUtcIso('2026-10-19T08:30')).toBe('2026-10-19T01:30:00.000Z');
  });

  it('crosses midnight back into the previous UTC day', () => {
    expect(zonedLocalToUtcIso('2026-10-19T03:00')).toBe('2026-10-18T20:00:00.000Z');
    expect(zonedLocalToUtcIso('2026-01-01T00:00')).toBe('2025-12-31T17:00:00.000Z');
  });

  it('accepts seconds and is unaffected by DST elsewhere (US DST ends 2026-11-01)', () => {
    expect(zonedLocalToUtcIso('2026-11-01T14:15:30')).toBe('2026-11-01T07:15:30.000Z');
    expect(zonedLocalToUtcIso('2026-03-08T10:00')).toBe('2026-03-08T03:00:00.000Z');
  });

  it('handles leap days', () => {
    expect(zonedLocalToUtcIso('2028-02-29T06:00')).toBe('2028-02-28T23:00:00.000Z');
  });

  it('rejects invalid input', () => {
    expect(zonedLocalToUtcIso('')).toBeNull();
    expect(zonedLocalToUtcIso('2026-10-19')).toBeNull();
    expect(zonedLocalToUtcIso('2026-02-30T10:00')).toBeNull();
    expect(zonedLocalToUtcIso('2026-13-01T10:00')).toBeNull();
    expect(zonedLocalToUtcIso('2026-10-19T24:00')).toBeNull();
    expect(zonedLocalToUtcIso('19/10/2026 10:00')).toBeNull();
  });

  it('round-trips with the UTC -> Vientiane conversion', () => {
    expect(utcIsoToZonedLocal('2026-10-19T13:00:00.000Z')).toBe('2026-10-19T20:00');
    expect(utcIsoToZonedLocal('2026-10-18T20:00:00Z')).toBe('2026-10-19T03:00');
    for (const local of ['2026-10-19T00:00', '2026-12-31T23:59', '2027-06-15T12:34']) {
      expect(utcIsoToZonedLocal(zonedLocalToUtcIso(local)!)).toBe(local);
    }
    expect(utcIsoToZonedLocal('not a date')).toBe('');
  });

  it('reports a +7h offset', () => {
    expect(zoneOffsetMs(Date.UTC(2026, 9, 18, 12))).toBe(7 * 3600 * 1000);
    expect(zoneOffsetMs(Date.UTC(2026, 9, 18, 12), 'UTC')).toBe(0);
  });
});

describe('display helpers', () => {
  it('formats ISO UTC timestamps in Lao time', () => {
    expect(formatDateTime('2026-10-19T13:00:00Z')).toBe('19/10/2026 20:00');
    expect(formatDateTime('2026-10-18T17:05:00Z')).toBe('19/10/2026 00:05');
    expect(formatDateTime(null)).toBe('—');
  });

  it('formats calendar dates without shifting them', () => {
    expect(formatDate('2026-10-19')).toBe('19/10/2026');
    expect(formatDate(null)).toBe('—');
  });

  it("computes today's date in Vientiane", () => {
    // 18:30 UTC on 18 Oct is already 01:30 on 19 Oct in Vientiane
    expect(todayInZone('Asia/Vientiane', new Date('2026-10-18T18:30:00Z'))).toBe('2026-10-19');
    expect(todayInZone('Asia/Vientiane', new Date('2026-10-18T16:59:00Z'))).toBe('2026-10-18');
  });

  it('adds days across month/year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats countdowns', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-5000)).toBe('00:00:00');
    expect(formatCountdown(61_000)).toBe('00:01:01');
    expect(formatCountdown(3 * 3600_000 + 4 * 60_000 + 5_000)).toBe('03:04:05');
    expect(formatCountdown(2 * 86400_000 + 3_000)).toBe('2 ມື້ 00:00:03');
  });
});
