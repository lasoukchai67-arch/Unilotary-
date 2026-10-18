// ຜູ້ໃຫ້ບໍລິການຈ່າຍເງິນ: ສ້າງ QR ເຕີມເງິນ, ກວດ webhook, ໂອນເງິນອອກ (ຖອນ).
// mock = ໂໝດທົດລອງ; lapnet = ໂຄງຮ່າງ ລໍຖ້າເອກະສານ API ແລະ key ຈາກທະນາຄານ.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Config } from '../config.js';
import { AppError } from '../lib/errors.js';

export interface DepositIntent {
  providerRef: string;
  qrPayload: string;
  expiresAt: Date;
}

export interface WebhookEvent {
  providerRef: string;
  status: 'success' | 'failed';
  amount: number;
}

export interface PayoutRequest {
  withdrawalId: number;
  amount: number;
  bankName: string;
  accountNo: string;
  accountName: string;
}

export interface PaymentProvider {
  readonly name: string;
  createDeposit(paymentId: number, amount: number): Promise<DepositIntent>;
  /** ກວດລາຍເຊັນຂອງ webhook ແລ້ວແປງເປັນ event; ລາຍເຊັນຜິດ → throw */
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent;
  payout(req: PayoutRequest): Promise<{ providerRef: string; status: 'paid' | 'failed' }>;
}

export function sign(secret: string, body: Buffer | string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function verifySignature(secret: string, rawBody: Buffer, signature: string | undefined): void {
  const expected = Buffer.from(sign(secret, rawBody), 'hex');
  const got = Buffer.from(signature ?? '', 'hex');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    throw new AppError('UNAUTHORIZED', 'ລາຍເຊັນ webhook ບໍ່ຖືກຕ້ອງ');
  }
}

function parseEvent(rawBody: Buffer): WebhookEvent {
  const body = JSON.parse(rawBody.toString('utf8'));
  if (typeof body.providerRef !== 'string' || !['success', 'failed'].includes(body.status) || !Number.isInteger(body.amount)) {
    throw new AppError('VALIDATION', 'webhook body ບໍ່ຖືກຕ້ອງ');
  }
  return { providerRef: body.providerRef, status: body.status, amount: body.amount };
}

export class MockPayments implements PaymentProvider {
  readonly name = 'mock';
  /** ໃຊ້ໃນ test ເພື່ອຈຳລອງການໂອນອອກລົ້ມເຫຼວ */
  failNextPayout = false;
  constructor(private secret: string) {}

  async createDeposit(paymentId: number, amount: number): Promise<DepositIntent> {
    const providerRef = `MOCK-${paymentId}-${randomUUID().slice(0, 8)}`;
    return {
      providerRef,
      qrPayload: `MOCKPAY|${providerRef}|${amount}|LAK`,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    };
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent {
    verifySignature(this.secret, rawBody, signature);
    return parseEvent(rawBody);
  }

  async payout(req: PayoutRequest) {
    if (this.failNextPayout) {
      this.failNextPayout = false;
      return { providerRef: `MOCKOUT-${req.withdrawalId}`, status: 'failed' as const };
    }
    return { providerRef: `MOCKOUT-${req.withdrawalId}`, status: 'paid' as const };
  }
}

// TODO(ເມື່ອໄດ້ສັນຍາ): ເຊື່ອມ LAPNet / BCEL OnePay ຕາມເອກະສານ API ຂອງທະນາຄານ.
// - createDeposit: ເອີ້ນ API ສ້າງ dynamic QR (EMVCo) ດ້ວຍ merchant id, ໄດ້ reference + QR string ກັບມາ
// - parseWebhook: ໃຊ້ວິທີກວດລາຍເຊັນຂອງທະນາຄານ (ອາດເປັນ HMAC ຫຼື RSA) ແທນ verifySignature
// - payout: ເອີ້ນ API ໂອນເງິນເຂົ້າບັນຊີ (ຖ້າທະນາຄານບໍ່ມີ, ໃຫ້ຝ່າຍການເງິນໂອນເອງ ແລ້ວກົດຢືນຢັນ)
export class LapnetPayments implements PaymentProvider {
  readonly name = 'lapnet';
  constructor(private config: Config) {}
  private notReady(): never {
    throw new AppError('PROVIDER_ERROR', 'ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່ LAPNet: ລໍຖ້າ API key ແລະ ເອກະສານຈາກທະນາຄານ');
  }
  async createDeposit(): Promise<DepositIntent> {
    return this.notReady();
  }
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent {
    verifySignature(this.config.PAYMENT_WEBHOOK_SECRET, rawBody, signature);
    return parseEvent(rawBody);
  }
  async payout(): Promise<{ providerRef: string; status: 'paid' | 'failed' }> {
    return this.notReady();
  }
}

export function createPayments(config: Config): PaymentProvider {
  return config.PAYMENT_PROVIDER === 'lapnet' ? new LapnetPayments(config) : new MockPayments(config.PAYMENT_WEBHOOK_SECRET);
}
