import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import type { AdminDraw } from '../../api/types';
import { useCurrentUser } from '../../auth/AuthContext';
import { useCan } from '../../auth/RequireAuth';
import { ConfirmDialog } from '../../components/Modal';
import { DrawStatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { Alert, ErrorBox, Field, Loading, Money, Num, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/datetime';
import { formatKip, formatRate } from '../../lib/format';
import { ExposurePanel } from './ExposurePanel';
import { ResultPanel } from './ResultPanel';

export function DrawDetailPage() {
  const { id } = useParams();
  const drawId = Number(id);
  const user = useCurrentUser();

  const q = useQuery({
    queryKey: ['draw', drawId],
    queryFn: () => api.admin.draws.get(drawId),
    enabled: Number.isInteger(drawId) && drawId > 0,
    refetchInterval: (query) => (query.state.data?.status === 'open' ? 15_000 : false),
  });

  if (!Number.isInteger(drawId) || drawId <= 0) return <Alert tone="error">ລະຫັດງວດບໍ່ຖືກຕ້ອງ</Alert>;

  return (
    <section>
      {q.isPending ? <Loading /> : null}
      <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      {q.data ? (
        <>
          <PageHeader
            title={`ງວດ ${q.data.drawNo}`}
            subtitle={
              <>
                <DrawStatusBadge status={q.data.status} /> ວັນອອກຫວຍ {formatDate(q.data.drawDate)}
              </>
            }
            actions={
              <>
                <Link to={`/reports/${q.data.id}`} className="btn btn--secondary">
                  ລາຍງານ
                </Link>
                <Link to="/draws" className="btn btn--secondary">
                  ກັບຄືນ
                </Link>
              </>
            }
          />
          <DrawSummary draw={q.data} />
          <DrawActions draw={q.data} />
          <ResultPanel draw={q.data} user={user} />
          <ExposurePanel draw={q.data} />
        </>
      ) : null}
    </section>
  );
}

function DrawSummary({ draw }: { draw: AdminDraw }) {
  return (
    <div className="card">
      <dl className="kv kv--grid">
        <div>
          <dt>ເປີດຂາຍ</dt>
          <dd>{formatDateTime(draw.salesOpenAt)}</dd>
        </div>
        <div>
          <dt>ປິດຂາຍ</dt>
          <dd>{formatDateTime(draw.salesCloseAt)}</dd>
        </div>
        <div>
          <dt>ຍອດຂາຍ</dt>
          <dd>
            <Money value={draw.stats?.sales} />
          </dd>
        </div>
        <div>
          <dt>ຈຳນວນບິນ</dt>
          <dd>
            <Num value={draw.stats?.tickets} />
          </dd>
        </div>
        {draw.resultedAt ? (
          <div>
            <dt>ອອກຜົນເມື່ອ</dt>
            <dd>{formatDateTime(draw.resultedAt)}</dd>
          </div>
        ) : null}
      </dl>
      <h2 className="card__title card__title--sub">ກົດການຂາຍ</h2>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th scope="col">ປະເພດ</th>
              <th scope="col" className="num">
                ອັດຕາຈ່າຍ
              </th>
              <th scope="col" className="num">
                ຂັ້ນຕ່ຳຕໍ່ແຖວ
              </th>
              <th scope="col" className="num">
                ສູງສຸດຕໍ່ແຖວ
              </th>
              <th scope="col" className="num">
                ເພດານຕໍ່ເລກ
              </th>
            </tr>
          </thead>
          <tbody>
            {[...draw.rules]
              .sort((a, b) => a.digits - b.digits)
              .map((r) => (
                <tr key={r.digits}>
                  <th scope="row">{r.digits} ໂຕ</th>
                  <td className="num">{formatRate(r.payoutRate)}</td>
                  <td className="num">{formatKip(r.minAmount)}</td>
                  <td className="num">{formatKip(r.maxPerLine)}</td>
                  <td className="num">{formatKip(r.defaultNumberCap)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type DrawAction = 'open' | 'close' | 'cancel';

function DrawActions({ draw }: { draw: AdminDraw }) {
  const allowed = useCan('draws.manage');
  const queryClient = useQueryClient();
  const toast = useToast();
  const [action, setAction] = useState<DrawAction | null>(null);
  const [reason, setReason] = useState('');
  const [typedNo, setTypedNo] = useState('');

  const run = useMutation({
    mutationFn: (a: DrawAction) =>
      a === 'open'
        ? api.admin.draws.open(draw.id)
        : a === 'close'
          ? api.admin.draws.close(draw.id)
          : api.admin.draws.cancel(draw.id, reason.trim()),
    onSuccess: (d, a) => {
      queryClient.setQueryData(['draw', d.id], d);
      void queryClient.invalidateQueries({ queryKey: ['draws'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['exposure', d.id] });
      setAction(null);
      setReason('');
      setTypedNo('');
      toast(a === 'open' ? 'ເປີດຂາຍແລ້ວ' : a === 'close' ? 'ປິດຂາຍແລ້ວ' : 'ຍົກເລີກງວດ ແລະ ຄືນເງິນແລ້ວ');
    },
  });

  if (!allowed) return null;
  const s = draw.status;
  const canOpen = s === 'scheduled'; // the API only opens a scheduled draw
  const canClose = s === 'open';
  const canCancel = s === 'scheduled' || s === 'open' || s === 'closed';
  if (!canOpen && !canClose && !canCancel) return null;

  const begin = (a: DrawAction) => {
    run.reset();
    setAction(a);
  };

  return (
    <div className="action-bar">
      {canOpen ? (
        <button type="button" className="btn btn--primary" onClick={() => begin('open')}>
          ເປີດຂາຍດຽວນີ້
        </button>
      ) : null}
      {canClose ? (
        <button type="button" className="btn btn--secondary" onClick={() => begin('close')}>
          ປິດຂາຍດຽວນີ້
        </button>
      ) : null}
      {canCancel ? (
        <button type="button" className="btn btn--danger-outline" onClick={() => begin('cancel')}>
          ຍົກເລີກງວດ
        </button>
      ) : null}

      {action === 'open' || action === 'close' ? (
        <ConfirmDialog
          title={action === 'open' ? `ເປີດຂາຍງວດ ${draw.drawNo}?` : `ປິດຂາຍງວດ ${draw.drawNo}?`}
          confirmLabel={action === 'open' ? 'ເປີດຂາຍ' : 'ປິດຂາຍ'}
          busy={run.isPending}
          error={run.error}
          onConfirm={() => run.mutate(action)}
          onCancel={() => setAction(null)}
        >
          <p>
            {action === 'open'
              ? 'ລູກຄ້າຈະສາມາດຊື້ຫວຍງວດນີ້ໄດ້ທັນທີ.'
              : 'ລູກຄ້າຈະບໍ່ສາມາດຊື້ຫວຍງວດນີ້ໄດ້ອີກ ແລະ ສາມາດປ້ອນຜົນໄດ້.'}
          </p>
        </ConfirmDialog>
      ) : null}

      {action === 'cancel' ? (
        <ConfirmDialog
          title={`ຍົກເລີກງວດ ${draw.drawNo}`}
          confirmLabel="ຍົກເລີກງວດ ແລະ ຄືນເງິນ"
          tone="danger"
          busy={run.isPending}
          error={run.error}
          confirmDisabled={reason.trim().length < 3 || typedNo.trim() !== draw.drawNo}
          onConfirm={() => run.mutate('cancel')}
          onCancel={() => setAction(null)}
        >
          <Alert tone="error">
            <strong>ຄຳເຕືອນ:</strong> ບິນທີ່ຍັງໃຊ້ງານທັງໝົດ ({draw.stats?.tickets ?? 0} ບິນ,{' '}
            {formatKip(draw.stats?.sales ?? 0)}) ຈະຖືກຍົກເລີກ ແລະ ຄືນເງິນເຂົ້າກະເປົາລູກຄ້າ. ບໍ່ສາມາດກັບຄືນໄດ້.
          </Alert>
          <Field label="ເຫດຜົນ (ຈຳເປັນ)" htmlFor="cancel-reason">
            <textarea
              id="cancel-reason"
              className="input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-autofocus
            />
          </Field>
          <Field label={`ພິມເລກງວດ "${draw.drawNo}" ເພື່ອຢືນຢັນ`} htmlFor="cancel-confirm-no">
            <input
              id="cancel-confirm-no"
              className="input mono"
              autoComplete="off"
              value={typedNo}
              onChange={(e) => setTypedNo(e.target.value)}
            />
          </Field>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
