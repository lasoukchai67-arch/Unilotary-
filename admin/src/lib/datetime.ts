// Date/time helpers. All admin input/output is in Lao time (Asia/Vientiane, UTC+7, no DST);
// the API always uses ISO-8601 UTC strings. Conversions use Intl with an explicit time zone
// so they do not depend on the browser's local zone.

export const LAO_TZ = 'Asia/Vientiane';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(utcMs: number, timeZone: string): Wall {
  const parts = partsFormatter(timeZone).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset of `timeZone` from UTC at the given instant, in ms (Vientiane: +7h). */
export function zoneOffsetMs(utcMs: number, timeZone: string = LAO_TZ): number {
  const w = wallClock(utcMs, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - (utcMs - (((utcMs % 1000) + 1000) % 1000));
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/**
 * Convert a wall-clock time in `timeZone` (the value of an <input type="datetime-local">,
 * "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss") to an ISO-8601 UTC string.
 * "2026-10-19T20:00" in Asia/Vientiane -> "2026-10-19T13:00:00.000Z". Returns null if invalid.
 */
export function zonedLocalToUtcIso(local: string, timeZone: string = LAO_TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(naive);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null; // e.g. 2026-02-30

  // Two passes handle zones whose offset changes near the instant (Vientiane has none).
  let utc = naive - zoneOffsetMs(naive, timeZone);
  const second = naive - zoneOffsetMs(utc, timeZone);
  if (second !== utc) utc = second;
  return new Date(utc).toISOString();
}

/** ISO UTC -> "YYYY-MM-DDTHH:mm" wall clock in `timeZone` (for datetime-local inputs). */
export function utcIsoToZonedLocal(iso: string, timeZone: string = LAO_TZ): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const w = wallClock(ms, timeZone);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** ISO UTC -> "DD/MM/YYYY HH:mm" in Lao time. */
export function formatDateTime(iso: string | null | undefined, timeZone: string = LAO_TZ): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  const w = wallClock(ms, timeZone);
  return `${pad(w.day)}/${pad(w.month)}/${w.year} ${pad(w.hour)}:${pad(w.minute)}`;
}

/** Date-only "YYYY-MM-DD" -> "DD/MM/YYYY" (no time-zone conversion: it is a calendar date). */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date;
}

/** Today's calendar date in `timeZone` as "YYYY-MM-DD". */
export function todayInZone(timeZone: string = LAO_TZ, now: Date = new Date()): string {
  return utcIsoToZonedLocal(now.toISOString(), timeZone).slice(0, 10);
}

/** "2026-10-31" + 1 -> "2026-11-01". */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Milliseconds -> "2 ມື້ 03:04:05" / "03:04:05". Negative values are shown as 00:00:00. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days} ມື້ ${clock}` : clock;
}
