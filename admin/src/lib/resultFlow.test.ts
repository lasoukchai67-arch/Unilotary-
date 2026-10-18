import { describe, expect, it } from 'vitest';
import { isValidResultNumber, type ResultDrawFields, resultPanelMode, sanitizeDigits, winningNumbers } from './resultFlow';

const draw = (over: Partial<ResultDrawFields> = {}): ResultDrawFields => ({
  status: 'closed',
  resultNumber: null,
  pendingResult: null,
  hasPendingResult: false,
  resultEnteredBy: null,
  ...over,
});
const maker = { id: 3, role: 'admin' as const };
const checker = { id: 4, role: 'admin' as const };

describe('resultPanelMode (maker–checker)', () => {
  it('closed draw without a pending result: an admin may enter the result', () => {
    expect(resultPanelMode(draw(), maker)).toEqual({ kind: 'enter' });
  });

  it('the maker sees the waiting state (the API returns the number only to the maker)', () => {
    const d = draw({ hasPendingResult: true, pendingResult: '482175', resultEnteredBy: 3 });
    expect(resultPanelMode(d, maker)).toEqual({ kind: 'awaiting-checker', pendingResult: '482175' });
  });

  it('a different admin must verify, and the mode never carries the pending number', () => {
    // As returned by the API to the checker: pendingResult is null, hasPendingResult true
    const d = draw({ hasPendingResult: true, pendingResult: null, resultEnteredBy: 3 });
    const mode = resultPanelMode(d, checker);
    expect(mode).toEqual({ kind: 'verify' });
    expect(JSON.stringify(mode)).not.toContain('4821');
  });

  it('even if a pending number leaked into the data, the checker mode does not expose it', () => {
    const d = draw({ hasPendingResult: true, pendingResult: '482175', resultEnteredBy: 3 });
    expect(resultPanelMode(d, checker)).toEqual({ kind: 'verify' });
  });

  it('uses hasPendingResult, not pendingResult, to detect a pending result', () => {
    expect(resultPanelMode(draw({ hasPendingResult: true, resultEnteredBy: 3 }), checker).kind).toBe('verify');
    expect(resultPanelMode(draw({ hasPendingResult: false, pendingResult: null }), checker).kind).toBe('enter');
  });

  it('finance and auditor are read-only', () => {
    expect(resultPanelMode(draw(), { id: 9, role: 'finance' })).toEqual({ kind: 'closed-readonly' });
    expect(resultPanelMode(draw({ hasPendingResult: true, resultEnteredBy: 3 }), { id: 9, role: 'auditor' })).toEqual({
      kind: 'pending-readonly',
    });
  });

  it('other draw states', () => {
    expect(resultPanelMode(draw({ status: 'open' }), maker)).toEqual({ kind: 'not-closed' });
    expect(resultPanelMode(draw({ status: 'scheduled' }), maker)).toEqual({ kind: 'not-closed' });
    expect(resultPanelMode(draw({ status: 'cancelled' }), maker)).toEqual({ kind: 'cancelled' });
    expect(resultPanelMode(draw({ status: 'resulted', resultNumber: '482175' }), maker)).toEqual({
      kind: 'resulted',
      resultNumber: '482175',
    });
  });
});

describe('result number input', () => {
  it('accepts exactly 6 digits', () => {
    expect(isValidResultNumber('482175')).toBe(true);
    expect(isValidResultNumber('012345')).toBe(true);
    expect(isValidResultNumber('48217')).toBe(false);
    expect(isValidResultNumber('4821755')).toBe(false);
    expect(isValidResultNumber('48a175')).toBe(false);
  });

  it('strips non-digits, converts Lao digits and limits length', () => {
    expect(sanitizeDigits('48-21 75')).toBe('482175');
    expect(sanitizeDigits('໔໘໒໑໗໕')).toBe('482175');
    expect(sanitizeDigits('12345678')).toBe('123456');
    expect(sanitizeDigits('12345678', 3)).toBe('123');
  });

  it('lists the winning last-N-digit numbers', () => {
    expect(winningNumbers('482175')).toEqual([
      { digits: 6, number: '482175' },
      { digits: 5, number: '82175' },
      { digits: 4, number: '2175' },
      { digits: 3, number: '175' },
      { digits: 2, number: '75' },
    ]);
    expect(winningNumbers('12')).toEqual([]);
  });
});
