import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Deps } from './infra.js';
import type { SmsProvider } from '../providers/sms.js';
import type { PaymentProvider } from '../providers/payments.js';
import { AppError } from './errors.js';

export interface Ctx extends Deps {
  sms: SmsProvider;
  payments: PaymentProvider;
}

export type Role = 'customer' | 'agent' | 'admin' | 'finance' | 'auditor';

export interface AuthUser {
  id: number;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthUser;
  }
}

export function currentUser(req: FastifyRequest): AuthUser {
  if (!req.auth) throw new AppError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບ');
  return req.auth;
}

export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  before: z.coerce.number().int().positive().optional(),
});

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export function nextBefore<T extends { id: number }>(items: T[], limit: number): number | null {
  return items.length === limit ? items[items.length - 1].id : null;
}

export const BIG = Number.MAX_SAFE_INTEGER;
