import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Dashboard } from '../api/types';
import { useCurrentUser } from '../auth/AuthContext';
import { DrawStatusBadge } from '../components/StatusBadge';
import { Countdown, ErrorBox, Loading, Money, Num, PageHeader, StatCard } from '../components/ui';
import { formatDate, formatDateTime } from '../lib/datetime';
import { can } from '../lib/roles';

export function DashboardPage() {
  const user = useCurrentUser();
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.admin.dashboard(),
    refetchInterval: 30_000,
  });

  return (
    <section>
      <PageHeader title="ໜ້າຫຼັກ" subtitle="ສະຫຼຸບມື້ນີ້ (ເວລາວຽງຈັນ)" />
      {q.isPending ? <Loading /> : null}
      <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      {q.data ? <DashboardBody data={q.data} serverOffsetMs={serverOffset(q.data, q.dataUpdatedAt)} role={user.role} /> : null}
    </section>
  );
}

function serverOffset(d: Dashboard, fetchedAt: number): number {
  const st = d.currentDraw?.serverTime ? Date.parse(d.currentDraw.serverTime) : NaN;
  return Number.isNaN(st) ? 0 : st - fetchedAt;
}

function DashboardBody({ data, serverOffsetMs, role }: { data: Dashboard; serverOffsetMs: number; role: Parameters<typeof can>[0] }) {
  const pending: { label: string; count: number; to: string }[] = [
    { label: 'KYC ລໍຖ້າກວດ', count: data.pending.kyc, to: '/kyc' },
    { label: 'ຖອນເງິນລໍຖ້າອະນຸມັດ', count: data.pending.withdrawals, to: '/withdrawals' },
    { label: 'ລາງວັນລໍຖ້າອະນຸມັດ', count: data.pending.payouts, to: '/payouts' },
    { label: 'ງວດລໍຖ້າອອກຜົນ', count: data.pending.results, to: '/draws?status=closed' },
  ];
  const d = data.currentDraw;

  return (
    <>
      <h2 className="section-title">ມື້ນີ້</h2>
      <div className="stats">
        <StatCard label="ຍອດຂາຍ" value={<Money value={data.today.sales} />} />
        <StatCard label="ຈຳນວນບິນ" value={<Num value={data.today.tickets} />} />
        <StatCard label="ເງິນເຕີມເຂົ້າ" value={<Money value={data.today.deposits} />} />
        <StatCard label="ເງິນຖອນອອກ" value={<Money value={data.today.withdrawals} />} />
        <StatCard
          label="ຜູ້ໃຊ້ທັງໝົດ"
          value={<Num value={data.users.total} />}
          hint={
            <>
              ຢືນຢັນຕົວຕົນແລ້ວ <Num value={data.users.verified} />
            </>
          }
        />
      </div>

      <h2 className="section-title">ລໍຖ້າດຳເນີນການ</h2>
      <div className="stats stats--pending">
        {pending.map((p) => (
          <Link key={p.to} to={p.to} className={`stat stat--link${p.count > 0 ? ' stat--attention' : ''}`}>
            <div className="stat__label">{p.label}</div>
            <div className="stat__value">
              <Num value={p.count} />
            </div>
            <div className="stat__hint">ເບິ່ງລາຍການ →</div>
          </Link>
        ))}
      </div>

      <h2 className="section-title">ງວດປັດຈຸບັນ</h2>
      {d ? (
        <div className="card draw-card">
          <div className="draw-card__head">
            <div>
              <div className="muted">ງວດທີ</div>
              <div className="draw-card__no">{d.drawNo}</div>
              <div className="muted">ວັນອອກຫວຍ {formatDate(d.drawDate)}</div>
            </div>
            <DrawStatusBadge status={d.status} />
          </div>
          <dl className="kv">
            <div>
              <dt>ເປີດຂາຍ</dt>
              <dd>{formatDateTime(d.salesOpenAt)}</dd>
            </div>
            <div>
              <dt>ປິດຂາຍ</dt>
              <dd>{formatDateTime(d.salesCloseAt)}</dd>
            </div>
            {d.stats ? (
              <div>
                <dt>ຍອດຂາຍງວດນີ້</dt>
                <dd>
                  <Money value={d.stats.sales} /> · <Num value={d.stats.tickets} /> ບິນ
                </dd>
              </div>
            ) : null}
          </dl>
          {d.status === 'open' ? (
            <p className="draw-card__countdown">
              ປິດຂາຍໃນ <Countdown targetIso={d.salesCloseAt} serverOffsetMs={serverOffsetMs} />
            </p>
          ) : d.status === 'scheduled' ? (
            <p className="draw-card__countdown">
              ເປີດຂາຍໃນ <Countdown targetIso={d.salesOpenAt} serverOffsetMs={serverOffsetMs} />
            </p>
          ) : null}
          <div className="form-actions">
            <Link className="btn btn--primary" to={`/draws/${d.id}`}>
              ເບິ່ງລາຍລະອຽດ / ຄວາມສ່ຽງ
            </Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <p>ບໍ່ມີງວດທີ່ເປີດ ຫຼື ກຳນົດໄວ້.</p>
          {can(role, 'draws.manage') ? (
            <Link className="btn btn--primary" to="/draws/new">
              ສ້າງງວດໃໝ່
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}
