import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { PayoutItem, PayoutStatus } from '../api/types';
import { useCurrentUser } from '../auth/AuthContext';
import { useCan } from '../auth/RequireAuth';
import { ConfirmDialog } from '../components/Modal';
import { PayoutBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { Alert, Empty, ErrorBox, Field, Loading, Money, PageHeader, Pager } from '../components/ui';
import { formatDateTime } from '../lib/datetime';
import { formatKip } from '../lib/format';
import { PAYOUT_STATUS } from '../lib/labels';
import { useCursorPager } from '../lib/useCursorPager';

const STATUSES = Object.keys(PAYOUT_STATUS) as PayoutStatus[];
const MIN_NOTE = 2; // server: note.trim().length >= 2

export function PayoutsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status: PayoutStatus = (STATUSES as string[]).includes(raw ?? '') ? (raw as PayoutStatus) : 'pending';
  const pager = useCursorPager(status);
  const canReview = useCan('payouts.review');
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<{ kind: 'approve' | 'reject'; p: PayoutItem } | null>(null);
  const [note, setNote] = useState('');

  const q = useQuery({
    queryKey: ['payouts', { status, before: pager.before }],
    queryFn: () => api.admin.payouts.list({ status, before: pager.before, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const decide = useMutation({
    mutationFn: ({ kind, p }: { kind: 'approve' | 'reject'; p: PayoutItem }) =>
      kind === 'approve' ? api.admin.payouts.approve(p.id) : api.admin.payouts.reject(p.id, note.trim()),
    onSuccess: (_res, { kind, p }) => {
      setPending(null);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['payouts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast(kind === 'approve' ? `ຈ່າຍລາງວັນບິນ ${p.ticketNo} ແລ້ວ` : `ປະຕິເສດລາງວັນບິນ ${p.ticketNo} ແລ້ວ`);
    },
  });

  const begin = (kind: 'approve' | 'reject', p: PayoutItem) => {
    decide.reset();
    setNote('');
    setPending({ kind, p });
  };

  return (
    <section>
      <PageHeader title="ຈ່າຍລາງວັນ (ລາງວັນໃຫຍ່)" subtitle="ລາງວັນທີ່ເກີນວົງເງິນຈ່າຍອັດຕະໂນມັດ ຕ້ອງອະນຸມັດກ່ອນເຂົ້າກະເປົາ" />
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="payout-status">ສະຖານະ</label>
          <select
            id="payout-status"
            className="select"
            value={status}
            onChange={(e) => setParams(e.target.value === 'pending' ? {} : { status: e.target.value }, { replace: true })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYOUT_STATUS[s]}
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
                  <th scope="col">ເລກບິນ</th>
                  <th scope="col">ເບີໂທ</th>
                  <th scope="col" className="num">
                    ລາງວັນ
                  </th>
                  <th scope="col">ສະຖານະ</th>
                  {canReview && status === 'pending' ? (
                    <th scope="col">
                      <span className="sr-only">ການດຳເນີນການ</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.id}</td>
                    <td className="nowrap">{formatDateTime(p.createdAt)}</td>
                    <td className="mono">{p.ticketNo}</td>
                    <td className="mono">
                      {p.userPhone}
                      {p.userId === me.id ? <div className="small muted">ລາຍການຂອງທ່ານ</div> : null}
                    </td>
                    <td className="num strong">
                      <Money value={p.amount} unit={false} />
                    </td>
                    <td>
                      <PayoutBadge status={p.status} />
                    </td>
                    {canReview && status === 'pending' ? (
                      <td className="nowrap">
                        {p.status === 'pending' ? (
                          <>
                            <button type="button" className="btn btn--primary btn--sm" onClick={() => begin('approve', p)}>
                              ອະນຸມັດ
                            </button>{' '}
                            <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => begin('reject', p)}>
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
          title={pending.kind === 'approve' ? 'ອະນຸມັດຈ່າຍລາງວັນ' : 'ປະຕິເສດການຈ່າຍລາງວັນ'}
          confirmLabel={pending.kind === 'approve' ? 'ອະນຸມັດຈ່າຍ' : 'ປະຕິເສດ'}
          tone={pending.kind === 'approve' ? 'primary' : 'danger'}
          busy={decide.isPending}
          error={decide.error}
          confirmDisabled={pending.kind === 'reject' && note.trim().length < MIN_NOTE}
          onConfirm={() => decide.mutate(pending)}
          onCancel={() => setPending(null)}
        >
          <dl className="kv confirm-summary">
            <div>
              <dt>ລາງວັນ</dt>
              <dd className="confirm-amount">{formatKip(pending.p.amount)}</dd>
            </div>
            <div>
              <dt>ເລກບິນ</dt>
              <dd className="mono">{pending.p.ticketNo}</dd>
            </div>
            <div>
              <dt>ເບີໂທລູກຄ້າ</dt>
              <dd className="mono">{pending.p.userPhone}</dd>
            </div>
          </dl>
          {pending.p.userId === me.id ? (
            <Alert tone="warn">ນີ້ແມ່ນລາງວັນຂອງທ່ານເອງ. ພະນັກງານບໍ່ສາມາດອະນຸມັດລາງວັນຂອງຕົນເອງໄດ້.</Alert>
          ) : null}
          {pending.kind === 'approve' ? (
            <p className="muted small">ເງິນລາງວັນຈະເຂົ້າກະເປົາລູກຄ້າທັນທີ.</p>
          ) : (
            <Field label="ເຫດຜົນ (ຈຳເປັນ)" htmlFor="payout-note" help={`ຢ່າງໜ້ອຍ ${MIN_NOTE} ຕົວອັກສອນ`}>
              <textarea
                id="payout-note"
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
