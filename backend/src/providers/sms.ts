// ສົ່ງ SMS: mock (ທົດລອງ) ຫຼື http (gateway ຂອງ Unitel / LTC / ETL ຫຼື aggregator).
import type { Config } from '../config.js';
import { AppError } from '../lib/errors.js';

export interface SmsProvider {
  readonly name: string;
  send(phone: string, text: string): Promise<void>;
}

export class MockSms implements SmsProvider {
  readonly name = 'mock';
  readonly sent: { phone: string; text: string }[] = [];
  async send(phone: string, text: string): Promise<void> {
    this.sent.push({ phone, text });
  }
}

// gateway ແບບ HTTP ທົ່ວໄປ: POST JSON { to, from, text } + Bearer token.
// ເມື່ອໄດ້ເອກະສານ API ຂອງຜູ້ໃຫ້ບໍລິການຕົວຈິງ ໃຫ້ປັບ body/headers ຢູ່ບ່ອນນີ້ບ່ອນດຽວ.
export class HttpSms implements SmsProvider {
  readonly name = 'http';
  constructor(
    private url: string,
    private token: string,
    private sender: string,
  ) {}
  async send(phone: string, text: string): Promise<void> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ to: phone, from: this.sender, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new AppError('PROVIDER_ERROR', 'ສົ່ງ SMS ບໍ່ສຳເລັດ', { status: res.status });
  }
}

export function createSms(config: Config): SmsProvider {
  if (config.SMS_PROVIDER === 'http') {
    if (!config.SMS_HTTP_URL || !config.SMS_HTTP_TOKEN) throw new Error('SMS_HTTP_URL and SMS_HTTP_TOKEN are required');
    return new HttpSms(config.SMS_HTTP_URL, config.SMS_HTTP_TOKEN, config.SMS_SENDER);
  }
  return new MockSms();
}
