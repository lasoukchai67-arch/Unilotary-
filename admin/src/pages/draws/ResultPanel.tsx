import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api as defaultApi } from '../../api';
import type { AdminDraw, ApproveResultResponse, Role, Settlement } from '../../api/types';
import { ConfirmDialog } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Alert, ErrorBox, Money, Num } from '../../components/ui';
import { isValidResultNumber, resultPanelMode, sanitizeDigits, winningNumbers } from '../../lib/resultFlow';

export interface ResultApi {
  enterResult(id: number, resultNumber: string): Promise<AdminDraw>;
  approveResult(id: number, resultNumber: string): Promise<ApproveResultResponse>;
  rejectResult(id: number): Promise<AdminDraw>;
}

interface Props {
  draw: AdminDraw;
  user: { id: number; role: Role };
  /** Injected in tests; defaults to the real API client. */
  resultApi?: ResultApi;
}

export function ResultPanel({ draw, user, resultApi = defaultApi.admin.draws }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mode = resultPanelMode(draw, user);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [value, setValue] = useState('');
  const [inputError, setInputError] = useState<string>();
  const [dialog, setDialog] = useState<'enter' | 'approve' | 'reject' | null>(null);

  const applyDraw = (d: AdminDraw) => {
    queryClient.setQueryData(['draw', d.id], d);
    void queryClient.invalidateQueries({ queryKey: ['draws'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const enter = useMutation({
    mutationFn: (n: string) => resultApi.enterResult(draw.id, n),
    onSuccess: (d) => {
      setDialog(null);
      setValue('');
      applyDraw(d);
      toast('ບັນທຶກຜົນແລ້ວ ລໍຖ້າແອັດມິນອີກຄົນຢືນຢັນ');
    },
  });
  const approve = useMutation({
    mutationFn: (n: string) => resultApi.approveResult(draw.id, n),
    onSuccess: (res) => {
      setDialog(null);
      setValue('');
      setSettlement(res.settlement);
      applyDraw(res.draw);
      void queryClient.invalidateQueries({ queryKey: ['payouts'] });
      void queryClient.invalidateQueries({ queryKey: ['report', draw.id] });
      toast('ຢືນຢັນຜົນ ແລະ ຄິດໄລ່ລາງວັນສຳເລັດ');
    },
    onError: () => setDialog(null),
  });
  const reject = useMutation({
    mutationFn: () => resultApi.rejectResult(draw.id),
    onSuccess: (d) => {
      setDialog(null);
      setValue('');
      applyDraw(d);
      toast('ປະຕິເສດຜົນແລ້ວ ສາມາດປ້ອນຜົນໃໝ່ໄດ້', 'info');
    },
  });

  const submit = (kind: 'enter' | 'approve') => (e: FormEvent) => {
    e.preventDefault();
    if (!isValidResultNumber(value)) {
      setInputError('ກະລຸນາໃສ່ເລກ 6 ຫຼັກ');
      return;
    }
    setInputError(undefined);
    enter.reset();
    approve.reset();
    setDialog(kind);
  };

  const numberInput = (id: string, label: string) => (
    <div className={`field${inputError ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        className="input input--result"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={6}
        value={value}
        onChange={(e) => setValue(sanitizeDigits(e.target.value))}
        aria-invalid={!!inputError}
        aria-describedby={inputError ? `${id}-error` : undefined}
      />
      {inputError ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          {inputError}
        </p>
      ) : null}
    </div>
  );

  return (
    <section className="card" aria-labelledby="result-title">
      <h2 className="card__title" id="result-title">
        ຜົນການອອກເລກ
      </h2>

      {mode.kind === 'cancelled' ? <p className="muted">ງວດນີ້ຖືກຍົກເລີກ ບໍ່ມີຜົນ.</p> : null}

      {mode.kind === 'not-closed' ? (
        <p className="muted">ປ້ອນຜົນໄດ້ຫຼັງຈາກປິດຂາຍແລ້ວ.</p>
      ) : null}

      {mode.kind === 'closed-readonly' ? <p className="muted">ລໍຖ້າແອັດມິນປ້ອນຜົນ.</p> : null}

      {mode.kind === 'pending-readonly' ? (
        <Alert tone="info">ມີຜົນທີ່ປ້ອນແລ້ວ ລໍຖ້າແອັດມິນອີກຄົນຢືນຢັນ.</Alert>
      ) : null}

      {mode.kind === 'resulted' ? (
        <div>
          <div className="result-digits" aria-label={`ເລກທີ່ອອກ ${mode.resultNumber}`}>
            {mode.resultNumber.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <ul className="win-list">
            {winningNumbers(mode.resultNumber).map((w) => (
              <li key={w.digits}>
                <span className="muted">{w.digits} ໂຕ</span> <strong className="mono">{w.number}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {settlement ? (
        <div className="settlement" role="status">
          <h3 className="settlement__title">ສະຫຼຸບການຄິດໄລ່ລາງວັນ</h3>
          <dl className="kv kv--grid">
            <div>
              <dt>ຈຳນວນບິນທີ່ຖືກ</dt>
              <dd>
                <Num value={settlement.winners} />
              </dd>
            </div>
            <div>
              <dt>ລາງວັນລວມ</dt>
              <dd>
                <Money value={settlement.totalWin} />
              </dd>
            </div>
            <div>
              <dt>ຈ່າຍອັດຕະໂນມັດ</dt>
              <dd>
                <Num value={settlement.autoPaid} />
              </dd>
            </div>
            <div>
              <dt>ລໍຖ້າອະນຸມັດຈ່າຍ</dt>
              <dd>
                <Num value={settlement.pendingPayouts} />
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {mode.kind === 'enter' ? (
        <form onSubmit={submit('enter')} noValidate className="result-form">
          <p className="muted small">ຂັ້ນຕອນທີ 1/2: ປ້ອນຜົນ. ຕ້ອງໃຫ້ແອັດມິນອີກຄົນພິມຢືນຢັນກ່ອນຄິດໄລ່ລາງວັນ.</p>
          {numberInput('result-enter', 'ເລກທີ່ອອກ (6 ຫຼັກ)')}
          <button type="submit" className="btn btn--primary" disabled={enter.isPending}>
            ບັນທຶກຜົນ
          </button>
        </form>
      ) : null}

      {mode.kind === 'awaiting-checker' ? (
        <Alert tone="info">
          <strong>ລໍຖ້າແອັດມິນອີກຄົນຢືນຢັນ</strong>
          <br />
          {mode.pendingResult ? (
            <>
              ທ່ານປ້ອນຜົນ <strong className="mono">{mode.pendingResult}</strong> ແລ້ວ.{' '}
            </>
          ) : null}
          ຜູ້ທີ່ປ້ອນຜົນບໍ່ສາມາດຢືນຢັນເອງໄດ້.
        </Alert>
      ) : null}

      {mode.kind === 'verify' ? (
        <form onSubmit={submit('approve')} noValidate className="result-form">
          <Alert tone="warn">
            ມີຜົນທີ່ແອັດມິນອີກຄົນປ້ອນໄວ້. ກະລຸນາກວດກັບຜົນທາງການ ແລ້ວ <strong>ພິມເລກຄືນໃໝ່ດ້ວຍຕົນເອງ</strong> ເພື່ອຢືນຢັນ.
          </Alert>
          {numberInput('result-verify', 'ພິມເລກທີ່ອອກອີກຄັ້ງ (6 ຫຼັກ)')}
          <ErrorBox error={approve.error} />
          <ErrorBox error={reject.error} />
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={approve.isPending || reject.isPending}>
              ຢືນຢັນຜົນ
            </button>
            <button
              type="button"
              className="btn btn--danger-outline"
              disabled={approve.isPending || reject.isPending}
              onClick={() => {
                reject.reset();
                setDialog('reject');
              }}
            >
              ປະຕິເສດຜົນ
            </button>
          </div>
        </form>
      ) : null}

      {dialog === 'enter' ? (
        <ConfirmDialog
          title="ຢືນຢັນການບັນທຶກຜົນ"
          confirmLabel="ບັນທຶກຜົນ"
          busy={enter.isPending}
          error={enter.error}
          onConfirm={() => enter.mutate(value)}
          onCancel={() => setDialog(null)}
        >
          <p>ງວດ {draw.drawNo}: ເລກທີ່ອອກແມ່ນ</p>
          <div className="result-digits result-digits--sm">
            {value.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        </ConfirmDialog>
      ) : null}

      {dialog === 'approve' ? (
        <ConfirmDialog
          title="ຢືນຢັນຜົນ ແລະ ຄິດໄລ່ລາງວັນ"
          confirmLabel="ຢືນຢັນ ແລະ ອອກຜົນ"
          busy={approve.isPending}
          error={approve.error}
          onConfirm={() => approve.mutate(value)}
          onCancel={() => setDialog(null)}
        >
          <p>
            ງວດ {draw.drawNo}: ເລກທີ່ທ່ານພິມ <strong className="mono">{value}</strong>
          </p>
          <p className="muted">ເມື່ອຢືນຢັນແລ້ວ ລະບົບຈະຄິດໄລ່ລາງວັນ ແລະ ຈ່າຍເງິນທັນທີ. ບໍ່ສາມາດແກ້ໄຂໄດ້.</p>
        </ConfirmDialog>
      ) : null}

      {dialog === 'reject' ? (
        <ConfirmDialog
          title="ປະຕິເສດຜົນທີ່ປ້ອນໄວ້"
          confirmLabel="ປະຕິເສດຜົນ"
          tone="danger"
          busy={reject.isPending}
          error={reject.error}
          onConfirm={() => reject.mutate()}
          onCancel={() => setDialog(null)}
        >
          <p>ຜົນທີ່ລໍຖ້າຢືນຢັນຈະຖືກລຶບ ແລະ ຕ້ອງປ້ອນຜົນໃໝ່.</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
