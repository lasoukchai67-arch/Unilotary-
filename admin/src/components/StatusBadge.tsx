import type { DrawStatus, KycStatus, PayoutStatus, UserStatus, WithdrawalStatus } from '../api/types';
import {
  drawStatusLabel,
  kycLabel,
  payoutStatusLabel,
  userStatusLabel,
  withdrawalStatusLabel,
} from '../lib/labels';
import { Badge, type BadgeTone } from './ui';

const DRAW_TONE: Record<DrawStatus, BadgeTone> = {
  scheduled: 'blue',
  open: 'mint',
  closed: 'amber',
  resulted: 'green',
  cancelled: 'dark',
};
const KYC_TONE: Record<KycStatus, BadgeTone> = { unsubmitted: 'grey', pending: 'amber', verified: 'green', rejected: 'dark' };
const USER_TONE: Record<UserStatus, BadgeTone> = { active: 'green', suspended: 'amber', closed: 'dark' };
const WD_TONE: Record<WithdrawalStatus, BadgeTone> = {
  requested: 'amber',
  approved: 'blue',
  paid: 'green',
  rejected: 'dark',
  failed: 'dark',
};
const PAYOUT_TONE: Record<PayoutStatus, BadgeTone> = { pending: 'amber', paid: 'green', rejected: 'dark' };

export const DrawStatusBadge = ({ status }: { status: DrawStatus }) => (
  <Badge tone={DRAW_TONE[status] ?? 'grey'}>{drawStatusLabel(status)}</Badge>
);
export const KycBadge = ({ status }: { status: KycStatus }) => (
  <Badge tone={KYC_TONE[status] ?? 'grey'}>{kycLabel(status)}</Badge>
);
export const UserStatusBadge = ({ status }: { status: UserStatus }) => (
  <Badge tone={USER_TONE[status] ?? 'grey'}>{userStatusLabel(status)}</Badge>
);
export const WithdrawalBadge = ({ status }: { status: WithdrawalStatus }) => (
  <Badge tone={WD_TONE[status] ?? 'grey'}>{withdrawalStatusLabel(status)}</Badge>
);
export const PayoutBadge = ({ status }: { status: PayoutStatus }) => (
  <Badge tone={PAYOUT_TONE[status] ?? 'grey'}>{payoutStatusLabel(status)}</Badge>
);
