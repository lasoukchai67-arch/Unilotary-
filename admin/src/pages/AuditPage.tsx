import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { api } from '../api';
import { Empty, ErrorBox, Loading, PageHeader, Pager } from '../components/ui';
import { formatDateTime } from '../lib/datetime';
import { useCursorPager } from '../lib/useCursorPager';

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}

export function AuditPage() {
  const pager = useCursorPager();
  const [open, setOpen] = useState<Set<number>>(new Set());

  const q = useQuery({
    queryKey: ['audit', { before: pager.before }],
    queryFn: () => api.admin.audit.list({ before: pager.before, limit: 50 }),
    placeholderData: keepPreviousData,
  });

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section>
      <PageHeader title="ບັນທຶກການກວດສອບ" subtitle="ທຸກການປ່ຽນແປງໂດຍພະນັກງານ (ແກ້ໄຂ ຫຼື ລຶບບໍ່ໄດ້)" />
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
                  <th scope="col">
                    <span className="sr-only">ລາຍລະອຽດ</span>
                  </th>
                  <th scope="col">ເວລາ</th>
                  <th scope="col">ຜູ້ດຳເນີນການ</th>
                  <th scope="col">ການກະທຳ</th>
                  <th scope="col">ຂໍ້ມູນ</th>
                  <th scope="col">ລະຫັດ</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((a) => {
                  const expanded = open.has(a.id);
                  return (
                    <Fragment key={a.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="icon-btn icon-btn--outline"
                            aria-expanded={expanded}
                            aria-controls={`audit-${a.id}`}
                            aria-label={expanded ? 'ເຊື່ອງລາຍລະອຽດ' : 'ສະແດງລາຍລະອຽດ'}
                            onClick={() => toggle(a.id)}
                          >
                            <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                          </button>
                        </td>
                        <td className="nowrap">{formatDateTime(a.createdAt)}</td>
                        <td className="mono">{a.actorPhone ?? (a.actorId ? `#${a.actorId}` : 'ລະບົບ')}</td>
                        <td className="mono">{a.action}</td>
                        <td>{a.entity}</td>
                        <td className="mono">{a.entityId ?? '—'}</td>
                      </tr>
                      {expanded ? (
                        <tr id={`audit-${a.id}`} className="row--detail">
                          <td colSpan={6}>
                            <div className="diff">
                              <div>
                                <h3 className="diff__title">ກ່ອນ</h3>
                                <Json value={a.before} />
                              </div>
                              <div>
                                <h3 className="diff__title">ຫຼັງ</h3>
                                <Json value={a.after} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
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
