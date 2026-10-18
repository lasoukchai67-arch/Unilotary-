import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { ErrorBox, Field, PageHeader } from '../components/ui';
import { sanitizeDigits } from '../lib/resultFlow';

const WEAK = new Set(['000000', '111111', '123456', '654321', '123123', '112233']);

export function PinPage() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const firstLogin = !!(location.state as { firstLogin?: boolean } | null)?.firstLogin;
  const from = (location.state as { from?: string } | null)?.from;

  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string>();

  const save = useMutation({
    mutationFn: async () => {
      await api.me.setPin(pin, user.pinSet ? currentPin : undefined);
      return api.me.get();
    },
    onSuccess: (me) => {
      setUser(me);
      toast(user.pinSet ? 'ປ່ຽນ PIN ສຳເລັດ' : 'ຕັ້ງ PIN ສຳເລັດ');
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (user.pinSet && currentPin.length !== 6) return setFormError('ກະລຸນາໃສ່ PIN ປັດຈຸບັນ 6 ຫຼັກ');
    if (pin.length !== 6) return setFormError('PIN ຕ້ອງເປັນຕົວເລກ 6 ຫຼັກ');
    if (WEAK.has(pin)) return setFormError('PIN ນີ້ຄາດເດົາງ່າຍເກີນໄປ');
    if (pin !== confirm) return setFormError('PIN ທັງສອງບໍ່ກົງກັນ');
    setFormError(undefined);
    save.mutate();
  };

  const pinInput = (id: string, value: string, set: (v: string) => void, autoFocus = false) => (
    <input
      id={id}
      className="input input--lg input--code"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      value={value}
      onChange={(e) => set(sanitizeDigits(e.target.value, 6))}
      autoFocus={autoFocus}
      required
    />
  );

  return (
    <section className="narrow">
      <PageHeader
        title={user.pinSet ? 'ປ່ຽນລະຫັດ PIN' : 'ຕັ້ງລະຫັດ PIN'}
        subtitle={
          firstLogin
            ? 'ບັນຊີຂອງທ່ານຍັງບໍ່ມີ PIN. ກະລຸນາຕັ້ງ PIN 6 ຫຼັກ ເພື່ອຄວາມປອດໄພ.'
            : 'PIN 6 ຫຼັກ ໃຊ້ຢືນຢັນລາຍການສຳຄັນ. ໃສ່ຜິດ 5 ຄັ້ງ ຈະຖືກລັອກ 15 ນາທີ.'
        }
      />
      <form className="card" onSubmit={submit} noValidate>
        {user.pinSet ? (
          <Field label="PIN ປັດຈຸບັນ" htmlFor="current-pin">
            {pinInput('current-pin', currentPin, setCurrentPin, true)}
          </Field>
        ) : null}
        <Field label="PIN ໃໝ່ (6 ຫຼັກ)" htmlFor="new-pin">
          {pinInput('new-pin', pin, setPin, !user.pinSet)}
        </Field>
        <Field label="ຢືນຢັນ PIN ໃໝ່" htmlFor="confirm-pin" error={formError}>
          {pinInput('confirm-pin', confirm, setConfirm)}
        </Field>
        <ErrorBox error={save.error} />
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ PIN'}
          </button>
          {!user.pinSet ? (
            <Link to="/" className="btn btn--secondary">
              ຂ້າມໄປກ່ອນ
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}
