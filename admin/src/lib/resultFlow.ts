import type { AdminDraw, Role } from '../api/types';
import { can } from './roles';

/**
 * What the result (maker–checker) panel shows for a draw and the signed-in user.
 * A pending result is detected with `hasPendingResult` (the API only sends `pendingResult`
 * to the admin who entered it). The `verify` mode deliberately carries no number: the
 * checker re-types the result blind.
 */
export type ResultPanelMode =
  | { kind: 'cancelled' }
  | { kind: 'resulted'; resultNumber: string }
  | { kind: 'not-closed' } // scheduled / open: results are entered after sales close
  | { kind: 'enter' } // maker step
  | { kind: 'awaiting-checker'; pendingResult: string | null } // the current user is the maker
  | { kind: 'verify' } // checker step: a different admin re-types the number
  | { kind: 'pending-readonly' } // pending result exists, user cannot act
  | { kind: 'closed-readonly' }; // closed, no pending result, user cannot act

export type ResultDrawFields = Pick<
  AdminDraw,
  'status' | 'resultNumber' | 'pendingResult' | 'hasPendingResult' | 'resultEnteredBy'
>;

export function resultPanelMode(
  draw: ResultDrawFields,
  user: { id: number; role: Role } | null | undefined,
): ResultPanelMode {
  if (draw.status === 'cancelled') return { kind: 'cancelled' };
  if (draw.status === 'resulted' && draw.resultNumber) return { kind: 'resulted', resultNumber: draw.resultNumber };
  if (draw.status !== 'closed') return { kind: 'not-closed' };

  const mayAct = !!user && can(user.role, 'results.manage');
  if (!draw.hasPendingResult) return mayAct ? { kind: 'enter' } : { kind: 'closed-readonly' };
  if (user && draw.resultEnteredBy === user.id) {
    return { kind: 'awaiting-checker', pendingResult: draw.pendingResult ?? null };
  }
  return mayAct ? { kind: 'verify' } : { kind: 'pending-readonly' };
}

export const RESULT_LENGTH = 6;

export function isValidResultNumber(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/** Keep only ASCII digits (also converts Lao digits ໐-໙) and cut to `max` characters. */
export function sanitizeDigits(input: string, max: number = RESULT_LENGTH): string {
  const ascii = input.replace(/[໐-໙]/g, (c) => String(c.charCodeAt(0) - 0x0ed0));
  return ascii.replace(/\D/g, '').slice(0, max);
}

/** Which numbers win for a 6-digit result: last N digits, N = 2..6 (for display). */
export function winningNumbers(result: string): { digits: number; number: string }[] {
  if (!isValidResultNumber(result)) return [];
  return [6, 5, 4, 3, 2].map((n) => ({ digits: n, number: result.slice(-n) }));
}
