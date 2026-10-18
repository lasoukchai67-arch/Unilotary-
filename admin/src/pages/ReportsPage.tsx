import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { DrawReport } from '../api/types';
import { DrawStatusBadge } from '../components/StatusBadge';
import { Alert, Empty, ErrorBox, Loading, Money, Num, PageHeader, Pager, StatCard } from '../components/ui';
import { CSV_BOM, downloadText, drawReportCsv } from '../lib/csv';
import { formatDate } from '../lib/datetime';
import { formatPercent, percentOf } from '../lib/format';
import { useCursorPager } from '../lib/useCursorPager';

/** List of draws to pick a report from. */
export function ReportsPage() {
  const pager = useCursorPager();
  const q = useQuery({
    queryKey: ['draws', { report: true, before: pager.before }],
    queryFn: () => api.admin.draws.list({ before: pager.before, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <section>
      <PageHeader title="ລາຍງານ" subtitle="ເລືອກງວດເພື່ອເບິ່ງລາຍງານຍອດຂາຍ, ລາງວັນ, ຄ່າຄອມ ແລະ ກຳໄລ" />
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
                  <th scope="col">ງວດ</th>
                  <th scope="col">ວັນອອກຫວຍ</th>
                  <th scope="col">ສະຖານະ</th>
                  <th scope="col">ຜົນ</th>
                  <th scope="col" className="num">
                    ຍອດຂາຍ
                  </th>
                  <th scope="col">
                    <span className="sr-only">ການດຳເນີນການ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((d) => (
                  <tr key={d.id}>
                    <td className="mono strong">{d.drawNo}</td>
                    <td>{formatDate(d.drawDate)}</td>
                    <td>
                      <DrawStatusBadge status={d.status} />
                    </td>
                    <td className="mono">{d.resultNumber ?? '—'}</td>
                    <td className="num">
                      <Money value={d.stats?.sales} unit={false} />
                    </td>
                    <td>
                      <Link to={`/reports/${d.id}`} className="btn btn--secondary btn--sm">
                        ເບິ່ງລາຍງານ
                      </Link>
                    </td>
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
    </section>
  );
}

export function DrawReportPage() {
  const { drawId: raw } = useParams();
  const drawId = Number(raw);
  const q = useQuery({
    queryKey: ['report', drawId],
    queryFn: () => api.admin.reports.draw(drawId),
    enabled: Number.isInteger(drawId) && drawId > 0,
  });

  if (!Number.isInteger(drawId) || drawId <= 0) return <Alert tone="error">ລະຫັດງວດບໍ່ຖືກຕ້ອງ</Alert>;

  return (
    <section>
      <PageHeader
        title={q.data ? `ລາຍງານງວດ ${q.data.drawNo}` : 'ລາຍງານງວດ'}
        actions={
          <>
            {q.data ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => downloadText(`report-draw-${q.data.drawNo}.csv`, CSV_BOM + drawReportCsv(q.data))}
              >
                ດາວໂຫຼດ CSV
              </button>
            ) : null}
            <Link to={`/draws/${drawId}`} className="btn btn--secondary">
              ເບິ່ງງວດ
            </Link>
            <Link to="/reports" className="btn btn--secondary">
              ກັບຄືນ
            </Link>
          </>
        }
      />
      {q.isPending ? <Loading /> : null}
      <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      {q.data ? <ReportBody r={q.data} /> : null}
    </section>
  );
}

function ReportBody({ r }: { r: DrawReport }) {
  const byDigits = [...r.sales.byDigits].sort((a, b) => a.digits - b.digits);
  return (
    <>
      <p>
        <DrawStatusBadge status={r.status} />{' '}
        {r.resultNumber ? (
          <>
            ເລກທີ່ອອກ <strong className="mono">{r.resultNumber}</strong>
          </>
        ) : (
          <span className="muted">ຍັງບໍ່ອອກຜົນ</span>
        )}
      </p>
      <div className="stats">
        <StatCard label="ຍອດຂາຍລວມ" value={<Money value={r.sales.total} />} hint={<><Num value={r.sales.tickets} /> ບິນ</>} />
        <StatCard
          label="ລາງວັນທັງໝົດ"
          value={<Money value={r.payouts.total} />}
          hint={
            <>
              ຈ່າຍແລ້ວ <Money value={r.payouts.paid} /> · ລໍຖ້າ <Money value={r.payouts.pending} />
            </>
          }
        />
        <StatCard label="ຄ່າຄອມມິດຊັ່ນ" value={<Money value={r.commissions} />} />
        <StatCard label="ກຳໄລສຸດທິ" value={<Money value={r.net} />} />
      </div>

      <div className="card">
        <h2 className="card__title">ຍອດຂາຍຕາມປະເພດ</h2>
        {byDigits.length === 0 ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">ປະເພດ</th>
                  <th scope="col" className="num">
                    ຈຳນວນແຖວ
                  </th>
                  <th scope="col" className="num">
                    ຍອດຂາຍ
                  </th>
                  <th scope="col" className="num">
                    ສັດສ່ວນ
                  </th>
                </tr>
              </thead>
              <tbody>
                {byDigits.map((d) => (
                  <tr key={d.digits}>
                    <th scope="row">{d.digits} ໂຕ</th>
                    <td className="num">
                      <Num value={d.lines} />
                    </td>
                    <td className="num">
                      <Money value={d.amount} unit={false} />
                    </td>
                    <td className="num">{formatPercent(percentOf(d.amount, r.sales.total))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">ລວມ</th>
                  <td className="num">
                    <Num value={byDigits.reduce((s, d) => s + d.lines, 0)} />
                  </td>
                  <td className="num">
                    <Money value={r.sales.total} unit={false} />
                  </td>
                  <td className="num">{formatPercent(percentOf(r.sales.total, r.sales.total))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
