import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Alert, ErrorBox, Field } from '../components/ui';
import { isValidLaoPhone, normalizePhone } from '../lib/phone';
import { sanitizeDigits } from '../lib/resultFlow';

const RESEND_SEC = 60;

export function LoginPage() {
  const { state, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string; reason?: string } | null)?.from;
  const reason = (location.state as { reason?: string } | null)?.reason;

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string>();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string>();
  const [denied, setDenied] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const requestOtp = useMutation({
    mutationFn: (p: string) => api.auth.requestOtp(p),
    onSuccess: (res) => {
      setDevCode(res.devCode);
      setStep('code');
      setCode('');
      setResendIn(RESEND_SEC);
    },
  });

  const verifyOtp = useMutation({
    mutationFn: ({ p, c }: { p: string; c: string }) => api.auth.verifyOtp(p, c),
    onSuccess: async (session) => {
      const ok = await signIn(session);
      if (!ok) {
        setDenied(true);
        setStep('phone');
        setCode('');
        setDevCode(undefined);
        return;
      }
      if (!session.user.pinSet) navigate('/pin', { replace: true, state: { firstLogin: true, from } });
      else navigate(from && from !== '/login' ? from : '/', { replace: true });
    },
  });

  if (state.status === 'authenticated' && !verifyOtp.isPending && !verifyOtp.isSuccess) {
    return <Navigate to="/" replace />;
  }

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    setDenied(false);
    const p = normalizePhone(phone);
    if (!isValidLaoPhone(p)) {
      setPhoneError('ເບີໂທບໍ່ຖືກຕ້ອງ (020XXXXXXXX ຫຼື 030XXXXXXX)');
      return;
    }
    setPhoneError(undefined);
    setPhone(p);
    requestOtp.mutate(p);
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    verifyOtp.mutate({ p: normalizePhone(phone), c: code });
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <span className="brand__mark brand__mark--lg" aria-hidden="true">
            ຫ
          </span>
          <div>
            <h1 className="login__title">ລະບົບຈັດການ ຫວຍພັດທະນາ</h1>
            <p className="muted">ສຳລັບພະນັກງານເທົ່ານັ້ນ</p>
          </div>
        </div>

        {denied ? (
          <Alert tone="error">
            <strong>ບໍ່ມີສິດເຂົ້າ</strong>
            <br />
            ບັນຊີນີ້ບໍ່ແມ່ນແອັດມິນ, ການເງິນ ຫຼື ຜູ້ກວດສອບ.
          </Alert>
        ) : reason === 'expired' ? (
          <Alert tone="warn">ໝົດເວລາເຂົ້າລະບົບ ກະລຸນາເຂົ້າໃໝ່</Alert>
        ) : null}

        {step === 'phone' ? (
          <form onSubmit={submitPhone} noValidate>
            <Field label="ເບີໂທລະສັບ" htmlFor="phone" error={phoneError} help="ຕົວຢ່າງ 020 5555 1234">
              <input
                id="phone"
                className="input input--lg"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? 'phone-error' : 'phone-help'}
                required
                autoFocus
              />
            </Field>
            <ErrorBox error={requestOtp.error} />
            <button type="submit" className="btn btn--primary btn--block" disabled={requestOtp.isPending}>
              {requestOtp.isPending ? 'ກຳລັງສົ່ງ...' : 'ຂໍລະຫັດ OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate>
            <p className="muted">
              ສົ່ງລະຫັດ OTP ໄປທີ່ <strong className="mono">{phone}</strong> ແລ້ວ
            </p>
            {devCode ? (
              <Alert tone="info">
                ລະຫັດທົດສອບ (dev): <strong className="mono">{devCode}</strong>
              </Alert>
            ) : null}
            <Field label="ລະຫັດ OTP 6 ຫຼັກ" htmlFor="otp">
              <input
                id="otp"
                className="input input--lg input--code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(sanitizeDigits(e.target.value, 6))}
                required
                autoFocus
              />
            </Field>
            <ErrorBox error={verifyOtp.error} />
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={code.length !== 6 || verifyOtp.isPending}
            >
              {verifyOtp.isPending ? 'ກຳລັງກວດສອບ...' : 'ເຂົ້າສູ່ລະບົບ'}
            </button>
            <div className="login__links">
              <button
                type="button"
                className="btn btn--link"
                onClick={() => {
                  setStep('phone');
                  verifyOtp.reset();
                  requestOtp.reset();
                }}
              >
                ປ່ຽນເບີໂທ
              </button>
              <button
                type="button"
                className="btn btn--link"
                disabled={resendIn > 0 || requestOtp.isPending}
                onClick={() => requestOtp.mutate(phone)}
              >
                {resendIn > 0 ? `ສົ່ງລະຫັດໃໝ່ (${resendIn} ວິ)` : 'ສົ່ງລະຫັດໃໝ່'}
              </button>
            </div>
            {requestOtp.error ? <ErrorBox error={requestOtp.error} /> : null}
          </form>
        )}
      </div>
    </div>
  );
}
