// Types mirror docs/API.md (API Contract v1). Money is an integer number of kip.
// Timestamps are ISO-8601 strings in UTC.

export type Role = 'customer' | 'agent' | 'admin' | 'finance' | 'auditor';
export type KycStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';
export type UserStatus = 'active' | 'suspended' | 'closed';
export type DrawStatus = 'scheduled' | 'open' | 'closed' | 'resulted' | 'cancelled';
export type WithdrawalStatus = 'requested' | 'approved' | 'paid' | 'rejected' | 'failed';
export type PayoutStatus = 'pending' | 'paid' | 'rejected';
export type Digits = 2 | 3 | 4 | 5 | 6;

export interface User {
  id: number;
  phone: string;
  fullName: string | null;
  role: Role;
  kyc: KycStatus;
  kycNote: string | null;
  status: UserStatus;
  pinSet: boolean;
  dailySpendCap: number | null;
  selfExcludedUntil: string | null;
  balance: number;
  held: number;
  commissionBp: number;
  createdAt: string;
}

export interface DigitRule {
  digits: Digits;
  payoutRate: number;
  minAmount: number;
  maxPerLine: number;
}

export interface AdminDigitRule extends DigitRule {
  defaultNumberCap: number;
}

export interface Draw {
  id: number;
  drawNo: string;
  drawDate: string; // YYYY-MM-DD
  salesOpenAt: string;
  salesCloseAt: string;
  status: DrawStatus;
  resultNumber: string | null;
  resultedAt: string | null;
  rules: DigitRule[];
  serverTime: string;
}

export interface AdminDraw extends Omit<Draw, 'rules'> {
  /** The pending (maker) result number. Only returned to the admin who entered it; null for everyone else. */
  pendingResult: string | null;
  /** True while a result is entered and waiting for a second admin (use this, not pendingResult). */
  hasPendingResult: boolean;
  resultEnteredBy: number | null;
  rules: AdminDigitRule[];
  stats: { sales: number; tickets: number };
}

export interface Withdrawal {
  id: number;
  amount: number;
  bankName: string;
  accountNo: string;
  accountName: string;
  status: WithdrawalStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWithdrawal extends Withdrawal {
  userId: number;
  userPhone: string;
}

export interface Page<T> {
  items: T[];
  nextBefore: number | null;
}

export interface PageParams {
  limit?: number;
  before?: number | null;
}

// ---------- Auth ----------
export interface OtpRequestResponse {
  expiresInSec: number;
  devCode?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  user: User;
}

// ---------- Admin ----------
export interface Dashboard {
  today: { sales: number; tickets: number; deposits: number; withdrawals: number };
  users: { total: number; verified: number };
  pending: { kyc: number; withdrawals: number; payouts: number; results: number };
  currentDraw: (Draw & Partial<Pick<AdminDraw, 'pendingResult' | 'hasPendingResult' | 'resultEnteredBy' | 'stats'>>) | null;
}

export interface CreateDrawBody {
  drawNo: string;
  drawDate: string;
  salesOpenAt: string;
  salesCloseAt: string;
  rules: AdminDigitRule[];
}

export interface ExposureItem {
  number: string;
  sold: number;
  cap: number;
  payoutRate: number;
  exposure: number;
  closed: boolean;
}

export interface NumberLimitBody {
  cap: number | null;
  payoutRate: number | null;
  closed: boolean;
}

export interface Settlement {
  winners: number;
  totalWin: number;
  autoPaid: number;
  pendingPayouts: number;
}

export interface ApproveResultResponse {
  draw: AdminDraw;
  settlement: Settlement;
}

export interface KycItem {
  userId: number;
  phone: string;
  fullName: string | null;
  birthDate: string | null;
  idCardNo: string | null;
  kyc: KycStatus;
  submittedAt: string | null;
}

export interface PayoutItem {
  id: number;
  ticketId: number;
  ticketNo: string;
  userId: number;
  userPhone: string;
  amount: number;
  status: PayoutStatus;
  createdAt: string;
}

export interface UserPatch {
  role?: Role;
  status?: UserStatus;
  commissionBp?: number;
}

export interface AuditItem {
  id: number;
  actorId: number | null;
  actorPhone: string | null;
  action: string;
  entity: string;
  entityId: string | number | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export type SettingKey =
  | 'payout_auto_limit'
  | 'deposit_min'
  | 'deposit_max'
  | 'withdraw_min'
  | 'withdraw_max_daily';

export interface Setting {
  key: string;
  value: unknown;
}

export interface DrawReport {
  drawNo: string;
  status: DrawStatus;
  resultNumber: string | null;
  sales: {
    total: number;
    tickets: number;
    byDigits: { digits: Digits; amount: number; lines: number }[];
  };
  payouts: { total: number; paid: number; pending: number };
  commissions: number;
  net: number;
}
