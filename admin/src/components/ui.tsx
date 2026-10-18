import { type ReactNode, useEffect, useState } from 'react';
import { ApiError, errorMessage, isApiError } from '../api/errors';
import { formatKip, formatNumber } from '../lib/format';
import { formatCountdown } from '../lib/datetime';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Money({ value, unit = true, className }: { value: number | null | undefined; unit?: boolean; className?: string }) {
  const neg = typeof value === 'number' && value < 0;
  return <span className={['money', neg ? 'money--neg' : '', className ?? ''].join(' ').trim()}>{formatKip(value, { unit })}</span>;
}

export function Num({ value }: { value: number | null | undefined }) {
  return <>{formatNumber(value)}</>;
}

export type BadgeTone = 'green' | 'mint' | 'grey' | 'dark' | 'amber' | 'blue';

export function Badge({ tone = 'grey', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Loading({ label = 'ກຳລັງໂຫຼດ...' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const details = isApiError(error) ? (error as ApiError).details : undefined;
  return (
    <div className="alert alert--error" role="alert">
      <div className="alert__body">
        <strong>{errorMessage(error)}</strong>
        {isApiError(error) && error.code !== 'NETWORK' ? <span className="alert__code"> ({error.code})</span> : null}
        {details !== undefined && details !== null ? (
          <details className="alert__details">
            <summary>ລາຍລະອຽດ</summary>
            <pre>{JSON.stringify(details, null, 2)}</pre>
          </details>
        ) : null}
      </div>
      {onRetry ? (
        <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
          ລອງໃໝ່
        </button>
      ) : null}
    </div>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="alert__body">{children}</div>
    </div>
  );
}

export function Empty({ children = 'ບໍ່ມີຂໍ້ມູນ' }: { children?: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function StatCard({ label, value, hint, to }: { label: string; value: ReactNode; hint?: ReactNode; to?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint ? <div className="stat__hint">{hint}</div> : null}
      {to}
    </div>
  );
}

/** Ticking countdown to `targetIso`, corrected by the server clock offset (serverTime - local now). */
export function Countdown({ targetIso, serverOffsetMs = 0 }: { targetIso: string; serverOffsetMs?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remaining = Date.parse(targetIso) - (now + serverOffsetMs);
  return (
    <span className="countdown" aria-live="off">
      {formatCountdown(remaining)}
    </span>
  );
}

export function Pager({
  page,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  busy,
}: {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  busy?: boolean;
}) {
  if (!hasPrev && !hasNext) return null;
  return (
    <nav className="pager" aria-label="ໜ້າ">
      <button type="button" className="btn btn--secondary btn--sm" onClick={onPrev} disabled={!hasPrev || busy}>
        ← ກ່ອນໜ້າ
      </button>
      <span className="pager__page">ໜ້າ {page + 1}</span>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onNext} disabled={!hasNext || busy}>
        ຕໍ່ໄປ →
      </button>
    </nav>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  help,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help ? (
        <p className="help-text" id={`${htmlFor}-help`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="error-text" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
