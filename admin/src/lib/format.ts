// Number/money formatting. Money in the API is an integer number of kip (LAK).

/** 1500000 -> "1,500,000"; rounds to an integer; "—" for null/NaN. */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const r = Math.round(n);
  const neg = r < 0;
  const digits = Math.abs(r).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return neg ? `-${grouped}` : grouped;
}

/** 1500000 -> "1,500,000 ກີບ" (or without unit). */
export function formatKip(n: number | null | undefined, opts: { unit?: boolean } = {}): string {
  const s = formatNumber(n);
  if (s === '—') return s;
  return opts.unit === false ? s : `${s} ກີບ`;
}

/**
 * Parse a kip amount typed by an admin: "1,500,000", "1 500 000", "1500000 ກີບ" -> 1500000.
 * Returns null for anything that is not a whole non-negative number.
 */
export function parseKip(input: string): number | null {
  const cleaned = input.replace(/ກີບ/g, '').replace(/[\s,]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

/** Payout rate (may be fractional, NUMERIC(12,2) server side): 60 -> "×60", 1.5 -> "×1.5". */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(Number(rate))) return '—';
  const v = Number(rate);
  const s = Number.isInteger(v)
    ? formatNumber(v)
    : v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `×${s}`;
}

/** Basis points -> percent string: 250 -> "2.5", 1000 -> "10", 1 -> "0.01". */
export function bpToPercent(bp: number): string {
  return String(Math.round(bp) / 100);
}

/**
 * Percent typed by the admin -> basis points: "2.5" -> 250. Accepts up to 2 decimals and 0..100 %.
 * Returns null when invalid.
 */
export function percentToBp(input: string): number | null {
  const s = input.trim().replace(',', '.').replace(/%$/, '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp >= 0 && bp <= 10000 ? bp : null;
}

/** Share of `part` in `whole` as a 0..100 number (clamped), or null if whole is 0. */
export function percentOf(part: number, whole: number): number | null {
  if (!whole || whole <= 0) return null;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

export function formatPercent(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}
