import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { AdminWithdrawal, WithdrawalStatus } from '../api/types';
import { useCurrentUser } from '../auth/AuthContext';
import { useCan } from '../auth/RequireAuth';
import { ConfirmDialog } from '../components/Modal';
import { WithdrawalBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { Alert, Empty, ErrorBox, Field, Loading, Money, PageHeader, Pager } from '../components/ui';
import { formatDateTime } from '../lib/datetime';
import { formatKip } from '../lib/format';
import { WITHDRAWAL_STATUS, withdrawalStatusLabel } from '../lib/labels';
import { useCursorPager } from '../lib/useCursorPager';

const STATUSES = Object.keys(WITHDRAWAL_STATUS) as WithdrawalStatus[];
const MIN_NOTE = 2; // server: note.trim().length >= 2

export function WithdrawalsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status: WithdrawalStatus = (STATUSES as string[]).includes(raw ?? '') ? (raw as WithdrawalStatus) : 'requested';
  const pager = useCursorPager(status);
  const canReview = useCan('withdrawals.review');
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<{ kind: 'approve' | 'reject'; w: AdminWithdrawal } | null>(null);
  const [note, setNote] = useState('');

  const q = useQuery({
    queryKey: ['withdrawals', { status, before: pager.before }],
    queryFn: () => api.admin.withdrawals.list({ status, before: pager.before, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const decide = useMutation({
    mutationFn: ({ kind, w }: { kind: 'approve' | 'reject'; w: AdminWithdrawal }) =>
      kind === 'approve' ? api.admin.withdrawals.approve(w.id) : api.admin.withdrawals.reject(w.id, note.trim()),
    onSuccess: (res, { kind }) => {
      setPending(null);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (kind === 'reject') toast('ປະຕິເສດແລ້ວ ເງິນຄືນເຂົ້າກະເປົາລູກຄ້າ');
      else if (res.status === 'failed') toast('ໂອນເງິນບໍ່ສຳເລັດ ເງິນຄືນເຂົ້າກະເປົາລູກຄ້າ', 'error');
      else toast(`ອະນຸມັດແລ້ວ: ${withdrawalStatusLabel(res.status)}`);
    },
  });

  const begin = (kind: 'approve' | 'reject', w: AdminWithdrawal) => {
    decide.reset();
    setNote('');
    setPending({ kind, w });
  };

  return (
    <section>
      <PageHeader title="ຖອນເງິນ" subtitle="ອະນຸມັດແລ້ວລະບົບຈະໂອນເງິນຜ່ານຜູ້ໃຫ້ບໍລິການທັນທີ" />
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="wd-status">ສະຖານະ</label>
          <select
            id="wd-status"
            className="select"
            value={status}
            onChange={(e) => setParams(e.target.value === 'requested' ? {} : { status: e.target.value }, { replace: true })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {WITHDRAWAL_STATUS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {q.isPending ? <Loading /> : null}
      <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      {q.data ? (
        q.data.items.length === 0 ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">ເວລາ</th>
                  <th scope="col">ເບີໂທ</th>
                  <th scope="col" className="num">
                    ຈຳນວນເງິນ
                  </th>
                  <th scope="col">ທະນາຄານ</th>
                  <th scope="col">ເລກບັນຊີ</th>
                  <th scope="col">ຊື່ບັນຊີ</th>
                  <th scope="col">ສະຖານະ</th>
                  <th scope="col">ໝາຍເຫດ</th>
                  {canReview && status === 'requested' ? (
                    <th scope="col">
                      <span className="sr-only">ການດຳເນີນການ</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((w) => (
                  <tr key={w.id}>
                    <td className="mono">{w.id}</td>
                    <td className="nowrap">{formatDateTime(w.createdAt)}</td>
                    <td className="mono">
                      {w.userPhone}
                      {w.userId === me.id ? <div className="small muted">ລາຍການຂອງທ່ານ</div> : null}
                    </td>
                    <td className="num strong">
                      <Money value={w.amount} unit={false} />
                    </td>
                    <td>{w.bankName}</td>
                    <td className="mono">{w.accountNo}</td>
                    <td>{w.accountName}</td>
                    <td>
                      <WithdrawalBadge status={w.status} />
                    </td>
                    <td className="small">{w.note ?? ''}</td>
                    {canReview && status === 'requested' ? (
                      <td className="nowrap">
                        {w.status === 'requested' ? (
                          <>
                            <button type="button" className="btn btn--primary btn--sm" onClick={() => begin('approve', w)}>
                              ອະນຸມັດ
                            </button>{' '}
                            <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => begin('reject', w)}>
                              ປະຕິເສດ
                            </button>
                          </>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
      <Pager
        page={pager.page}
        hasPrev={pager.hasPrev}
        hasNext={!!q.data?.nextBefore}
        onPrev={pager.prev}
        onNext={() => pager.next(q.data?.nextBefore)}
        busy={q.isFetching}
      />

      {pending ? (
        <ConfirmDialog
          title={pending.kind === 'approve' ? 'ອະນຸມັດການຖອນເງິນ' : 'ປະຕິເສດການຖອນເງິນ'}
          confirmLabel={pending.kind === 'approve' ? 'ອະນຸມັດ ແລະ ໂອນເງິນ' : 'ປະຕິເສດ'}
          tone={pending.kind === 'approve' ? 'primary' : 'danger'}
          busy={decide.isPending}
          error={decide.error}
          confirmDisabled={pending.kind === 'reject' && note.trim().length < MIN_NOTE}
          onConfirm={() => decide.mutate(pending)}
          onCancel={() => setPending(null)}
        >
          <dl className="kv confirm-summary">
            <div>
              <dt>ຈຳນວນເງິນ</dt>
              <dd className="confirm-amount">{formatKip(pending.w.amount)}</dd>
            </div>
            <div>
              <dt>ທະນາຄານ</dt>
              <dd>{pending.w.bankName}</dd>
            </div>
            <div>
              <dt>ເລກບັນຊີ</dt>
              <dd className="mono">{pending.w.accountNo}</dd>
            </div>
            <div>
              <dt>ຊື່ບັນຊີ</dt>
              <dd>{pending.w.accountName}</dd>
            </div>
            <div>
              <dt>ເບີໂທລູກຄ້າ</dt>
              <dd className="mono">{pending.w.userPhone}</dd>
            </div>
          </dl>
          {pending.w.userId === me.id ? (
            <Alert tone="warn">ນີ້ແມ່ນການຖອນເງິນຂອງທ່ານເອງ. ພະນັກງານບໍ່ສາມາດອະນຸມັດລາຍການຂອງຕົນເອງໄດ້.</Alert>
          ) : null}
          {pending.kind === 'approve' ? (
            <p className="muted small">ກວດຊື່ບັນຊີໃຫ້ກົງກັບຊື່ລູກຄ້າກ່ອນອະນຸມັດ. ເງິນຈະຖືກໂອນທັນທີ.</p>
          ) : (
            <Field label="ເຫດຜົນ (ຈຳເປັນ)" htmlFor="wd-note" help={`ຢ່າງໜ້ອຍ ${MIN_NOTE} ຕົວອັກສອນ, ລູກຄ້າຈະເຫັນຂໍ້ຄວາມນີ້`}>
              <textarea
                id="wd-note"
                className="input"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-autofocus
              />
            </Field>
          )}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
