import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Role, User, UserPatch, UserStatus } from '../api/types';
import { useCurrentUser } from '../auth/AuthContext';
import { useCan } from '../auth/RequireAuth';
import { Modal } from '../components/Modal';
import { KycBadge, UserStatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { Alert, Empty, ErrorBox, Field, Loading, Money, PageHeader, Pager } from '../components/ui';
import { formatDateTime } from '../lib/datetime';
import { bpToPercent, percentToBp } from '../lib/format';
import { ROLE, roleLabel, USER_STATUS } from '../lib/labels';
import { useCursorPager } from '../lib/useCursorPager';

const ROLES = Object.keys(ROLE) as Role[];
const STATUSES = Object.keys(USER_STATUS) as UserStatus[];

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const rawRole = params.get('role') ?? '';
  const role = (ROLES as string[]).includes(rawRole) ? (rawRole as Role) : '';
  const [search, setSearch] = useState(q);
  const pager = useCursorPager(`${q}|${role}`);
  const canManage = useCan('users.manage');
  const [editing, setEditing] = useState<User | null>(null);

  const list = useQuery({
    queryKey: ['users', { q, role, before: pager.before }],
    queryFn: () => api.admin.users.list({ q, role, before: pager.before, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const updateParams = (next: { q?: string; role?: string }) => {
    const merged = { q, role: role as string, ...next };
    const p: Record<string, string> = {};
    if (merged.q.trim()) p.q = merged.q.trim();
    if (merged.role) p.role = merged.role;
    setParams(p, { replace: true });
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    updateParams({ q: search });
  };

  return (
    <section>
      <PageHeader title="ຜູ້ໃຊ້" />
      <div className="toolbar">
        <form className="inline-form" role="search" onSubmit={submitSearch}>
          <label htmlFor="user-q" className="sr-only">
            ຄົ້ນຫາດ້ວຍເບີໂທ ຫຼື ຊື່
          </label>
          <input
            id="user-q"
            className="input"
            type="search"
            placeholder="ເບີໂທ ຫຼື ຊື່"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn--secondary">
            ຄົ້ນຫາ
          </button>
        </form>
        <div className="field field--inline">
          <label htmlFor="user-role">ບົດບາດ</label>
          <select id="user-role" className="select" value={role} onChange={(e) => updateParams({ role: e.target.value })}>
            <option value="">ທັງໝົດ</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.isPending ? <Loading /> : null}
      <ErrorBox error={list.error} onRetry={() => void list.refetch()} />
      {list.data ? (
        list.data.items.length === 0 ? (
          <Empty>ບໍ່ພົບຜູ້ໃຊ້</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">ເບີໂທ</th>
                  <th scope="col">ຊື່</th>
                  <th scope="col">ບົດບາດ</th>
                  <th scope="col">KYC</th>
                  <th scope="col">ສະຖານະ</th>
                  <th scope="col" className="num">
                    ຍອດເງິນ
                  </th>
                  <th scope="col" className="num">
                    ລໍຖ້າຖອນ
                  </th>
                  <th scope="col" className="num">
                    ຄ່າຄອມ
                  </th>
                  <th scope="col">ສະໝັກເມື່ອ</th>
                  {canManage ? (
                    <th scope="col">
                      <span className="sr-only">ການດຳເນີນການ</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">{u.id}</td>
                    <td className="mono">{u.phone}</td>
                    <td>{u.fullName ?? '—'}</td>
                    <td>{roleLabel(u.role)}</td>
                    <td>
                      <KycBadge status={u.kyc} />
                    </td>
                    <td>
                      <UserStatusBadge status={u.status} />
                    </td>
                    <td className="num">
                      <Money value={u.balance} unit={false} />
                    </td>
                    <td className="num">
                      <Money value={u.held} unit={false} />
                    </td>
                    <td className="num">{bpToPercent(u.commissionBp)}%</td>
                    <td className="nowrap">{formatDateTime(u.createdAt)}</td>
                    {canManage ? (
                      <td>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => setEditing(u)}
                          aria-label={`ແກ້ໄຂຜູ້ໃຊ້ ${u.phone}`}
                        >
                          ແກ້ໄຂ
                        </button>
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
        hasNext={!!list.data?.nextBefore}
        onPrev={pager.prev}
        onNext={() => pager.next(list.data?.nextBefore)}
        busy={list.isFetching}
      />
      {editing ? <EditUserDialog user={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function EditUserDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const me = useCurrentUser();
  const isSelf = me.id === user.id;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [commission, setCommission] = useState(bpToPercent(user.commissionBp));
  const [error, setError] = useState<string>();

  const save = useMutation({
    mutationFn: (patch: UserPatch) => api.admin.users.update(user.id, patch),
    onSuccess: (u) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast(`ບັນທຶກຂໍ້ມູນ ${u.phone} ແລ້ວ`);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const bp = percentToBp(commission);
    if (bp === null) return setError('ຄ່າຄອມຕ້ອງຢູ່ລະຫວ່າງ 0 ຫາ 100% (ທົດສະນິຍົມບໍ່ເກີນ 2 ຕຳແໜ່ງ)');
    const patch: UserPatch = {};
    if (role !== user.role) patch.role = role;
    if (status !== user.status) patch.status = status;
    if (bp !== user.commissionBp) patch.commissionBp = bp;
    if (Object.keys(patch).length === 0) return onClose();
    setError(undefined);
    save.mutate(patch);
  };

  return (
    <Modal title={`ແກ້ໄຂຜູ້ໃຊ້ ${user.phone}`} onClose={onClose} closeDisabled={save.isPending}>
      <form onSubmit={submit} noValidate>
        {isSelf ? <Alert tone="warn">ທ່ານບໍ່ສາມາດປ່ຽນບົດບາດ ຫຼື ສະຖານະຂອງຕົນເອງໄດ້.</Alert> : null}
        <Field label="ບົດບາດ" htmlFor="edit-role">
          <select id="edit-role" className="select" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ສະຖານະບັນຊີ" htmlFor="edit-status">
          <select
            id="edit-status"
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            disabled={isSelf}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {USER_STATUS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="ຄ່າຄອມມິດຊັ່ນ (%)"
          htmlFor="edit-commission"
          error={error}
          help={`= ${percentToBp(commission) ?? '—'} basis points (ໃຊ້ສຳລັບຕົວແທນ)`}
        >
          <input
            id="edit-commission"
            className="input num"
            inputMode="decimal"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </Field>
        {role !== user.role && (role === 'admin' || role === 'finance' || role === 'auditor') ? (
          <Alert tone="warn">ຜູ້ໃຊ້ນີ້ຈະເຂົ້າລະບົບຈັດການໄດ້ ດ້ວຍສິດ {roleLabel(role)}.</Alert>
        ) : null}
        <ErrorBox error={save.error} />
        <div className="modal__footer modal__footer--inline">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={save.isPending}>
            ຍົກເລີກ
          </button>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
