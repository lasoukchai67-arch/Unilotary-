import type { ApiClient } from './client';
import type {
  AdminDraw,
  AdminWithdrawal,
  ApproveResultResponse,
  AuditItem,
  AuthResponse,
  CreateDrawBody,
  Dashboard,
  Digits,
  DrawReport,
  DrawStatus,
  ExposureItem,
  KycItem,
  KycStatus,
  NumberLimitBody,
  OtpRequestResponse,
  Page,
  PageParams,
  PayoutItem,
  PayoutStatus,
  Role,
  Setting,
  User,
  UserPatch,
  WithdrawalStatus,
} from './types';

const seg = (v: string | number) => encodeURIComponent(String(v));

const page = (p: PageParams = {}) => ({ limit: p.limit, before: p.before ?? undefined });

export function createApi(client: ApiClient) {
  const get = <T>(path: string, query?: Record<string, string | number | undefined | null>) =>
    client.request<T>(path, { query });
  // Body-less actions (approve, open, close, ...) send `{}`: the backend's KYC approve route validates
  // its body as an optional object and rejects a missing body (Fastify passes null) with 400 VALIDATION.
  const post = <T>(path: string, body: unknown = {}) => client.request<T>(path, { method: 'POST', body });

  return {
    auth: {
      requestOtp: (phone: string) =>
        client.request<OtpRequestResponse>('/auth/otp/request', { method: 'POST', body: { phone }, auth: false }),
      verifyOtp: (phone: string, code: string) =>
        client.request<AuthResponse>('/auth/otp/verify', { method: 'POST', body: { phone, code }, auth: false }),
      /** Revokes the refresh token on the server (best effort) and always clears local tokens. */
      async logout(): Promise<void> {
        const refreshToken = client.tokens.getRefreshToken();
        try {
          if (refreshToken) {
            await client.request<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false });
          }
        } finally {
          client.tokens.clear();
        }
      },
    },

    me: {
      get: () => get<User>('/me'),
      setPin: (pin: string, currentPin?: string) =>
        post<void>('/me/pin', currentPin ? { pin, currentPin } : { pin }),
    },

    admin: {
      dashboard: () => get<Dashboard>('/admin/dashboard'),

      draws: {
        list: (p: PageParams & { status?: DrawStatus | '' } = {}) =>
          get<Page<AdminDraw>>('/admin/draws', { status: p.status || undefined, ...page(p) }),
        get: (id: number) => get<AdminDraw>(`/admin/draws/${seg(id)}`),
        create: (body: CreateDrawBody) => post<AdminDraw>('/admin/draws', body),
        open: (id: number) => post<AdminDraw>(`/admin/draws/${seg(id)}/open`),
        close: (id: number) => post<AdminDraw>(`/admin/draws/${seg(id)}/close`),
        cancel: (id: number, reason: string) => post<AdminDraw>(`/admin/draws/${seg(id)}/cancel`, { reason }),
        exposure: (id: number, digits: Digits, limit = 50) =>
          get<{ items: ExposureItem[] }>(`/admin/draws/${seg(id)}/exposure`, { digits, limit }),
        setNumberLimit: (id: number, number: string, body: NumberLimitBody) =>
          client.request<void>(`/admin/draws/${seg(id)}/numbers/${seg(number)}/limit`, { method: 'PUT', body }),
        enterResult: (id: number, resultNumber: string) =>
          post<AdminDraw>(`/admin/draws/${seg(id)}/result`, { resultNumber }),
        approveResult: (id: number, resultNumber: string) =>
          post<ApproveResultResponse>(`/admin/draws/${seg(id)}/result/approve`, { resultNumber }),
        rejectResult: (id: number) => post<AdminDraw>(`/admin/draws/${seg(id)}/result/reject`),
      },

      kyc: {
        list: (p: PageParams & { status?: KycStatus } = {}) =>
          get<Page<KycItem>>('/admin/kyc', { status: p.status ?? 'pending', ...page(p) }),
        document: (userId: number) =>
          client.request<Blob>(`/admin/kyc/${seg(userId)}/document`, { responseType: 'blob' }),
        approve: (userId: number) => post<User>(`/admin/kyc/${seg(userId)}/approve`),
        reject: (userId: number, note: string) => post<User>(`/admin/kyc/${seg(userId)}/reject`, { note }),
      },

      withdrawals: {
        list: (p: PageParams & { status?: WithdrawalStatus } = {}) =>
          get<Page<AdminWithdrawal>>('/admin/withdrawals', { status: p.status ?? 'requested', ...page(p) }),
        approve: (id: number) => post<AdminWithdrawal>(`/admin/withdrawals/${seg(id)}/approve`),
        reject: (id: number, note: string) => post<AdminWithdrawal>(`/admin/withdrawals/${seg(id)}/reject`, { note }),
      },

      payouts: {
        list: (p: PageParams & { status?: PayoutStatus } = {}) =>
          get<Page<PayoutItem>>('/admin/payouts', { status: p.status ?? 'pending', ...page(p) }),
        approve: (id: number) => post<PayoutItem>(`/admin/payouts/${seg(id)}/approve`),
        reject: (id: number, note: string) => post<PayoutItem>(`/admin/payouts/${seg(id)}/reject`, { note }),
      },

      users: {
        list: (p: PageParams & { q?: string; role?: Role | '' } = {}) =>
          get<Page<User>>('/admin/users', { q: p.q?.trim() || undefined, role: p.role || undefined, ...page(p) }),
        update: (id: number, patch: UserPatch) =>
          client.request<User>(`/admin/users/${seg(id)}`, { method: 'PATCH', body: patch }),
      },

      audit: {
        list: (p: PageParams = {}) => get<Page<AuditItem>>('/admin/audit', page(p)),
      },

      settings: {
        list: () => get<{ items: Setting[] }>('/admin/settings'),
        update: (key: string, value: unknown) =>
          client.request<Setting>(`/admin/settings/${seg(key)}`, { method: 'PUT', body: { value } }),
      },

      reports: {
        draw: (id: number) => get<DrawReport>(`/admin/reports/draws/${seg(id)}`),
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
