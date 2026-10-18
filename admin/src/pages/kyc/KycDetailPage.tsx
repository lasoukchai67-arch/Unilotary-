import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import type { KycItem } from '../../api/types';
import { useCurrentUser } from '../../auth/AuthContext';
import { useCan } from '../../auth/RequireAuth';
import { ConfirmDialog } from '../../components/Modal';
import { KycBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { Alert, ErrorBox, Field, Loading, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/datetime';

/** Loads the document with the Authorization header and exposes it as an object URL. */
function useKycDocument(userId: number) {
  const q = useQuery({
    queryKey: ['kyc-document', userId],
    queryFn: () => api.admin.kyc.document(userId),
    staleTime: Infinity,
    gcTime: 0, // do not keep ID card images in memory after leaving the page
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!q.data) return;
    const u = URL.createObjectURL(q.data);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(undefined);
    };
  }, [q.data]);
  return { ...q, url };
}

export function KycDetailPage() {
  const { userId: raw } = useParams();
  const userId = Number(raw);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canReview = useCan('kyc.review');
  const me = useCurrentUser();
  const isOwn = me.id === userId;
  const stateItem = (location.state as { item?: KycItem } | null)?.item;

  // No single-item endpoint exists: use the row passed from the list, else look it up in the pending list.
  const lookup = useQuery({
    queryKey: ['kyc', { status: 'pending', lookup: userId }],
    queryFn: () => api.admin.kyc.list({ status: 'pending', limit: 100 }),
    enabled: !stateItem && Number.isInteger(userId),
  });
  const item = stateItem ?? lookup.data?.items.find((k) => k.userId === userId);
  const doc = useKycDocument(userId);

  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [zoom, setZoom] = useState(false);

  const decide = useMutation({
    mutationFn: (kind: 'approve' | 'reject') =>
      kind === 'approve' ? api.admin.kyc.approve(userId) : api.admin.kyc.reject(userId, note.trim()),
    onSuccess: (user, kind) => {
      void queryClient.invalidateQueries({ queryKey: ['kyc'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast(kind === 'approve' ? `ອະນຸມັດ KYC ຂອງ ${user.phone} ແລ້ວ` : `ປະຕິເສດ KYC ຂອງ ${user.phone} ແລ້ວ`);
      navigate('/kyc');
    },
  });

  if (!Number.isInteger(userId)) return <Alert tone="error">ລະຫັດຜູ້ໃຊ້ບໍ່ຖືກຕ້ອງ</Alert>;

  return (
    <section>
      <PageHeader
        title="ກວດເອກະສານ KYC"
        subtitle={item ? `${item.fullName ?? ''} · ${item.phone}` : `ຜູ້ໃຊ້ #${userId}`}
        actions={
          <Link to="/kyc" className="btn btn--secondary">
            ກັບຄືນ
          </Link>
        }
      />
      <div className="split">
        <div className="card">
          <h2 className="card__title">ຂໍ້ມູນທີ່ລູກຄ້າປ້ອນ</h2>
          {lookup.isLoading ? <Loading /> : null}
          {item ? (
            <dl className="kv">
              <div>
                <dt>ຊື່ ແລະ ນາມສະກຸນ</dt>
                <dd>{item.fullName ?? '—'}</dd>
              </div>
              <div>
                <dt>ເບີໂທ</dt>
                <dd className="mono">{item.phone}</dd>
              </div>
              <div>
                <dt>ວັນເກີດ</dt>
                <dd>{formatDate(item.birthDate)}</dd>
              </div>
              <div>
                <dt>ເລກບັດປະຈຳຕົວ</dt>
                <dd className="mono">{item.idCardNo ?? '—'}</dd>
              </div>
              <div>
                <dt>ສົ່ງເມື່ອ</dt>
                <dd>{formatDateTime(item.submittedAt)}</dd>
              </div>
              <div>
                <dt>ສະຖານະ</dt>
                <dd>
                  <KycBadge status={item.kyc} />
                </dd>
              </div>
            </dl>
          ) : !lookup.isLoading ? (
            <p className="muted">ບໍ່ພົບລາຍການນີ້ໃນລາຍການລໍຖ້າກວດ (ອາດຖືກກວດແລ້ວ).</p>
          ) : null}
          <ErrorBox error={lookup.error} />

          {canReview && (!item || item.kyc === 'pending') ? (
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  decide.reset();
                  setDialog('approve');
                }}
              >
                ອະນຸມັດ
              </button>
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  decide.reset();
                  setDialog('reject');
                }}
              >
                ປະຕິເສດ
              </button>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2 className="card__title">ຮູບເອກະສານ</h2>
          {doc.isPending ? <Loading label="ກຳລັງໂຫຼດຮູບ..." /> : null}
          <ErrorBox error={doc.error} onRetry={() => void doc.refetch()} />
          {doc.url ? (
            <button
              type="button"
              className={`doc-image${zoom ? ' doc-image--zoom' : ''}`}
              onClick={() => setZoom((z) => !z)}
              aria-label={zoom ? 'ຫຍໍ້ຮູບ' : 'ຂະຫຍາຍຮູບ'}
            >
              <img src={doc.url} alt={`ເອກະສານຢືນຢັນຕົວຕົນຂອງຜູ້ໃຊ້ ${item?.phone ?? userId}`} />
            </button>
          ) : null}
        </div>
      </div>

      {dialog === 'approve' ? (
        <ConfirmDialog
          title="ອະນຸມັດ KYC"
          confirmLabel="ອະນຸມັດ"
          busy={decide.isPending}
          error={decide.error}
          onConfirm={() => decide.mutate('approve')}
          onCancel={() => setDialog(null)}
        >
          {isOwn ? <Alert tone="warn">ນີ້ແມ່ນເອກະສານຂອງທ່ານເອງ. ພະນັກງານບໍ່ສາມາດກວດ KYC ຂອງຕົນເອງໄດ້.</Alert> : null}
          <p>
            ຢືນຢັນວ່າເອກະສານຂອງ <strong>{item?.fullName ?? `#${userId}`}</strong> ຖືກຕ້ອງ ແລະ ອາຍຸ 18 ປີຂຶ້ນໄປ?
          </p>
        </ConfirmDialog>
      ) : null}
      {dialog === 'reject' ? (
        <ConfirmDialog
          title="ປະຕິເສດ KYC"
          confirmLabel="ປະຕິເສດ"
          tone="danger"
          busy={decide.isPending}
          error={decide.error}
          confirmDisabled={note.trim().length < 2}
          onConfirm={() => decide.mutate('reject')}
          onCancel={() => setDialog(null)}
        >
          <Field label="ເຫດຜົນ (ລູກຄ້າຈະເຫັນຂໍ້ຄວາມນີ້)" htmlFor="kyc-note" help="ຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ">
            <textarea
              id="kyc-note"
              className="input"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ເຊັ່ນ: ຮູບບໍ່ຊັດ, ຂໍ້ມູນບໍ່ກົງກັບບັດ"
              data-autofocus
            />
          </Field>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
