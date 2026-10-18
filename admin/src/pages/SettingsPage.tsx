import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api } from '../api';
import type { Setting, SettingKey } from '../api/types';
import { useCan } from '../auth/RequireAuth';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Alert, ErrorBox, Loading, PageHeader } from '../components/ui';
import { formatKip, formatNumber, parseKip } from '../lib/format';
import { SETTING_KEYS, SETTINGS } from '../lib/labels';
import { validateSettingValue, settingAsNumber } from '../lib/settings';

export function SettingsPage() {
  const canEdit = useCan('settings.manage');
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api.admin.settings.list() });
  const values = new Map<string, unknown>((q.data?.items ?? []).map((s) => [s.key, s.value]));
  const others = (q.data?.items ?? []).filter((s) => !(SETTING_KEYS as string[]).includes(s.key));

  return (
    <section>
      <PageHeader title="ຕັ້ງຄ່າລະບົບ" subtitle={canEdit ? undefined : 'ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ'} />
      {q.isPending ? <Loading /> : null}
      <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      {q.data ? (
        <div className="settings">
          {SETTING_KEYS.map((key) => (
            <SettingRow key={key} settingKey={key} value={values.get(key)} all={values} canEdit={canEdit} />
          ))}
          {others.length ? (
            <div className="card">
              <h2 className="card__title">ຄ່າອື່ນໆ</h2>
              <dl className="kv">
                {others.map((s: Setting) => (
                  <div key={s.key}>
                    <dt className="mono">{s.key}</dt>
                    <dd className="mono">{JSON.stringify(s.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SettingRow({
  settingKey,
  value,
  all,
  canEdit,
}: {
  settingKey: SettingKey;
  value: unknown;
  all: Map<string, unknown>;
  canEdit: boolean;
}) {
  const meta = SETTINGS[settingKey];
  const current = settingAsNumber(value);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputId = `setting-${settingKey}`;

  const save = useMutation({
    mutationFn: (v: number) => api.admin.settings.update(settingKey, v),
    onSuccess: () => {
      setConfirm(null);
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast(`ບັນທຶກ "${meta.label}" ແລ້ວ`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft === null) return;
    const v = parseKip(draft);
    if (v === null) return setError('ກະລຸນາໃສ່ຈຳນວນເງິນເປັນຕົວເລກ (ກີບ)');
    const consistency = validateSettingValue(settingKey, v, all);
    if (consistency) return setError(consistency);
    setError(undefined);
    save.reset();
    setConfirm(v);
  };

  return (
    <div className="card setting">
      <div className="setting__info">
        <h2 className="card__title">{meta.label}</h2>
        <p className="muted small">{meta.help}</p>
        <p className="mono small muted">{settingKey}</p>
      </div>
      <div className="setting__value">
        {draft === null ? (
          <>
            <div className="setting__current">{current === null ? JSON.stringify(value ?? null) : formatKip(current)}</div>
            {canEdit ? (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  setDraft(current === null ? '' : String(current));
                  setError(undefined);
                }}
                aria-label={`ແກ້ໄຂ ${meta.label}`}
              >
                ແກ້ໄຂ
              </button>
            ) : null}
          </>
        ) : (
          <form className="inline-form" onSubmit={submit} noValidate>
            <label htmlFor={inputId} className="sr-only">
              {meta.label} (ກີບ)
            </label>
            <input
              id={inputId}
              className="input num"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : undefined}
              autoFocus
            />
            <button type="submit" className="btn btn--primary btn--sm">
              ບັນທຶກ
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDraft(null)}>
              ຍົກເລີກ
            </button>
            {error ? (
              <p className="error-text" id={`${inputId}-error`} role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
      {confirm !== null ? (
        <ConfirmDialog
          title={`ປ່ຽນ "${meta.label}"`}
          confirmLabel="ບັນທຶກ"
          busy={save.isPending}
          error={save.error}
          onConfirm={() => save.mutate(confirm)}
          onCancel={() => setConfirm(null)}
        >
          <p>
            {current === null ? '—' : formatNumber(current)} → <strong>{formatKip(confirm)}</strong>
          </p>
          {settingKey === 'payout_auto_limit' ? (
            <Alert tone="warn">ລາງວັນທີ່ບໍ່ເກີນຈຳນວນນີ້ຈະຖືກຈ່າຍອັດຕະໂນມັດໂດຍບໍ່ຕ້ອງອະນຸມັດ.</Alert>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
