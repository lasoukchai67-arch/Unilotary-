import type { Role } from '../api/types';

/** Roles that may use the admin app at all. */
export const STAFF_ROLES = ['admin', 'finance', 'auditor'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: Role | string | null | undefined): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role ?? '');
}

/**
 * Write actions. Per docs/API.md: admin = everything; finance = withdrawals and payouts
 * (other pages read-only); auditor = GET endpoints only (read-only everywhere).
 */
export type Permission =
  | 'draws.manage' // create / open / close / cancel draws
  | 'risk.manage' // number limits on the exposure table
  | 'results.manage' // maker–checker result entry
  | 'kyc.review'
  | 'withdrawals.review'
  | 'payouts.review'
  | 'users.manage'
  | 'settings.manage';

const MATRIX: Record<StaffRole, readonly Permission[]> = {
  admin: [
    'draws.manage',
    'risk.manage',
    'results.manage',
    'kyc.review',
    'withdrawals.review',
    'payouts.review',
    'users.manage',
    'settings.manage',
  ],
  finance: ['withdrawals.review', 'payouts.review'],
  auditor: [],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return isStaffRole(role) && MATRIX[role].includes(permission);
}
