import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import type { KycStatus } from '../../api/types';
import { KycBadge } from '../../components/StatusBadge';
import { Empty, ErrorBox, Loading, PageHeader, Pager } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/datetime';
import { KYC_STATUS } from '../../lib/labels';
import { useCursorPager } from '../../lib/useCursorPager';

const FILTERS: KycStatus[] = ['pending', 'verified', 'rejected'];

export function KycListPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status: KycStatus = (FILTERS as string[]).includes(raw ?? '') ? (raw as KycStatus) : 'pending';
  const pager = useCursorPager(status);

  const q = useQuery({
    queryKey: ['kyc', { status, before: pager.before }],
    queryFn: () => api.admin.kyc.list({ status, before: pager.before, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <section>
      <PageHeader title="ຢືນຢັນຕົວຕົນ (KYC)" subtitle="ກວດເອກະສານຂອງລູກຄ້າກ່ອນອະນຸຍາດໃຫ້ຊື້ຫວຍ" />
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="kyc-status">ສະຖານະ</label>
          <select
            id="kyc-status"
            className="select"
            value={status}
            onChange={(e) => setParams(e.target.value === 'pending' ? {} : { status: e.target.value }, { replace: true })}
          >
            {FILTERS.map((s) => (
              <option key={s} value={s}>
                {KYC_STATUS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {q.isPending ? <Loading /> : null}
      <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      {q.data ? (
        q.data.items.length === 0 ? (
          <Empty>{status === 'pending' ? 'ບໍ່ມີລາຍການລໍຖ້າກວດ' : 'ບໍ່ມີຂໍ້ມູນ'}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">ເບີໂທ</th>
                  <th scope="col">ຊື່ ແລະ ນາມສະກຸນ</th>
                  <th scope="col">ວັນເກີດ</th>
                  <th scope="col">ເລກບັດ</th>
                  <th scope="col">ສົ່ງເມື່ອ</th>
                  <th scope="col">ສະຖານະ</th>
                  <th scope="col">
                    <span className="sr-only">ການດຳເນີນການ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((k) => (
                  <tr key={k.userId}>
                    <td className="mono">{k.phone}</td>
                    <td>{k.fullName ?? '—'}</td>
                    <td>{formatDate(k.birthDate)}</td>
                    <td className="mono">{k.idCardNo ?? '—'}</td>
                    <td className="nowrap">{formatDateTime(k.submittedAt)}</td>
                    <td>
                      <KycBadge status={k.kyc} />
                    </td>
                    <td>
                      <Link to={`/kyc/${k.userId}`} state={{ item: k }} className="btn btn--secondary btn--sm">
                        ກວດເອກະສານ
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
