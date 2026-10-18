import type {
  DrawStatus,
  KycStatus,
  PayoutStatus,
  Role,
  SettingKey,
  UserStatus,
  WithdrawalStatus,
} from '../api/types';

export const DRAW_STATUS: Record<DrawStatus, string> = {
  scheduled: 'ລໍຖ້າເປີດຂາຍ',
  open: 'ເປີດຂາຍ',
  closed: 'ປິດຂາຍແລ້ວ',
  resulted: 'ອອກຜົນແລ້ວ',
  cancelled: 'ຍົກເລີກ',
};

export const KYC_STATUS: Record<KycStatus, string> = {
  unsubmitted: 'ຍັງບໍ່ສົ່ງ',
  pending: 'ລໍຖ້າກວດ',
  verified: 'ຢືນຢັນແລ້ວ',
  rejected: 'ຖືກປະຕິເສດ',
};

export const ROLE: Record<Role, string> = {
  customer: 'ລູກຄ້າ',
  agent: 'ຕົວແທນ',
  admin: 'ແອັດມິນ',
  finance: 'ການເງິນ',
  auditor: 'ຜູ້ກວດສອບ',
};

export const USER_STATUS: Record<UserStatus, string> = {
  active: 'ໃຊ້ງານ',
  suspended: 'ລະງັບ',
  closed: 'ປິດບັນຊີ',
};

export const WITHDRAWAL_STATUS: Record<WithdrawalStatus, string> = {
  requested: 'ລໍຖ້າອະນຸມັດ',
  approved: 'ອະນຸມັດແລ້ວ (ກຳລັງໂອນ)',
  paid: 'ໂອນແລ້ວ',
  rejected: 'ປະຕິເສດ',
  failed: 'ໂອນບໍ່ສຳເລັດ',
};

export const PAYOUT_STATUS: Record<PayoutStatus, string> = {
  pending: 'ລໍຖ້າອະນຸມັດ',
  paid: 'ຈ່າຍແລ້ວ',
  rejected: 'ປະຕິເສດ',
};

export const SETTINGS: Record<SettingKey, { label: string; help: string }> = {
  payout_auto_limit: {
    label: 'ວົງເງິນຈ່າຍລາງວັນອັດຕະໂນມັດ',
    help: 'ລາງວັນບໍ່ເກີນຈຳນວນນີ້ຈະເຂົ້າກະເປົາອັດຕະໂນມັດ, ຫຼາຍກວ່ານີ້ຕ້ອງອະນຸມັດ',
  },
  deposit_min: { label: 'ເຕີມເງິນຂັ້ນຕ່ຳ', help: 'ຈຳນວນເງິນຕ່ຳສຸດຕໍ່ການເຕີມໜຶ່ງຄັ້ງ' },
  deposit_max: { label: 'ເຕີມເງິນສູງສຸດ', help: 'ຈຳນວນເງິນສູງສຸດຕໍ່ການເຕີມໜຶ່ງຄັ້ງ' },
  withdraw_min: { label: 'ຖອນເງິນຂັ້ນຕ່ຳ', help: 'ຈຳນວນເງິນຕ່ຳສຸດຕໍ່ການຖອນໜຶ່ງຄັ້ງ' },
  withdraw_max_daily: { label: 'ຖອນເງິນສູງສຸດຕໍ່ມື້', help: 'ຍອດຖອນລວມສູງສຸດຂອງຜູ້ໃຊ້ໜຶ່ງຄົນຕໍ່ມື້' },
};

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

const lookup =
  <K extends string>(map: Record<K, string>) =>
  (key: K | string | null | undefined): string =>
    key && key in map ? map[key as K] : (key ?? '—');

export const drawStatusLabel = lookup(DRAW_STATUS);
export const kycLabel = lookup(KYC_STATUS);
export const roleLabel = lookup(ROLE);
export const userStatusLabel = lookup(USER_STATUS);
export const withdrawalStatusLabel = lookup(WITHDRAWAL_STATUS);
export const payoutStatusLabel = lookup(PAYOUT_STATUS);
