import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import type { DrawStatus } from '../../api/types';
import { Can } from '../../auth/RequireAuth';
import { DrawStatusBadge } from '../../components/StatusBadge';
import { Empty, ErrorBox, Loading, Money, Num, PageHeader, Pager } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/datetime';
import { DRAW_STATUS } from '../../lib/labels';
import { useCursorPager } from '../../lib/useCursorPager';

const STATUSES = Object.keys(DRAW_STATUS) as DrawStatus[];

export function DrawsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('status') ?? '';
  const status = (STATUSES as string[]).includes(raw) ? (raw as DrawStatus) : '';
  const pager = useCursorPager(status);

  const q = useQuery({
    queryKey: ['draws', { status, before: pager.before }],
    queryFn: () => api.admin.draws.list({ status, before: pager.before, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <section>
      <PageHeader
        title="ງວດຫວຍ"
        actions={
          <Can permission="draws.manage">
            <Link to="/draws/new" className="btn btn--primary">
              + ສ້າງງວດໃໝ່
            </Link>
          </Can>
        }
      />
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="draw-status">ສະຖານະ</label>
          <select
            id="draw-status"
            className="select"
            value={status}
            onChange={(e) => {
              const v = e.target.value;
              setParams(v ? { status: v } : {}, { replace: true });
            }}
          >
            <option value="">ທັງໝົດ</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {DRAW_STATUS[s]}
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
                  <th scope="col">ງວດ</th>
                  <th scope="col">ວັນອອກຫວຍ</th>
                  <th scope="col">ເປີດຂາຍ</th>
                  <th scope="col">ປິດຂາຍ</th>
                  <th scope="col">ສະຖານະ</th>
                  <th scope="col">ຜົນ</th>
                  <th scope="col" className="num">
                    ຍອດຂາຍ
                  </th>
                  <th scope="col" className="num">
                    ບິນ
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
                    <td className="nowrap">{formatDateTime(d.salesOpenAt)}</td>
                    <td className="nowrap">{formatDateTime(d.salesCloseAt)}</td>
                    <td>
                      <DrawStatusBadge status={d.status} />
                      {d.hasPendingResult && d.status === 'closed' ? (
                        <div className="small muted">ມີຜົນລໍຖ້າຢືນຢັນ</div>
                      ) : null}
                    </td>
                    <td className="mono">{d.resultNumber ?? '—'}</td>
                    <td className="num">
                      <Money value={d.stats?.sales} unit={false} />
                    </td>
                    <td className="num">
                      <Num value={d.stats?.tickets} />
                    </td>
                    <td>
                      <Link to={`/draws/${d.id}`} className="btn btn--secondary btn--sm">
                        ເປີດ
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
