import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import type { CreateDrawBody, Digits } from '../../api/types';
import { useCan } from '../../auth/RequireAuth';
import { useToast } from '../../components/Toast';
import { Alert, ErrorBox, Field, PageHeader } from '../../components/ui';
import { addDays, todayInZone, utcIsoToZonedLocal, zonedLocalToUtcIso } from '../../lib/datetime';
import {
  buildCreateDrawBody,
  defaultRuleRows,
  type DrawFormErrors,
  type DrawFormValues,
  nextDrawNo,
  type RuleRow,
} from '../../lib/drawForm';
import { formatNumber } from '../../lib/format';

const FIVE_MIN = 5 * 60 * 1000;
const DEFAULT_CLOSE_TIME = '20:00';

function initialValues(): DrawFormValues {
  const drawDate = addDays(todayInZone(), 1);
  const openAt = new Date(Math.ceil(Date.now() / FIVE_MIN) * FIVE_MIN).toISOString();
  return {
    drawNo: '',
    drawDate,
    salesOpenLocal: utcIsoToZonedLocal(openAt),
    salesCloseLocal: `${drawDate}T${DEFAULT_CLOSE_TIME}`,
    rules: defaultRuleRows(),
  };
}

function utcHint(local: string): string {
  const iso = zonedLocalToUtcIso(local);
  return iso ? `UTC: ${iso.slice(0, 16).replace('T', ' ')}` : '';
}

type RuleField = keyof Omit<RuleRow, 'digits' | 'enabled'>;
const RULE_FIELDS: { key: RuleField; label: string; step: string }[] = [
  { key: 'payoutRate', label: 'ອັດຕາຈ່າຍ (×)', step: '0.01' },
  { key: 'minAmount', label: 'ຂັ້ນຕ່ຳຕໍ່ແຖວ (ກີບ)', step: '1' },
  { key: 'maxPerLine', label: 'ສູງສຸດຕໍ່ແຖວ (ກີບ)', step: '1' },
  { key: 'defaultNumberCap', label: 'ເພດານຕໍ່ເລກ (ກີບ)', step: '1' },
];

export function DrawCreatePage() {
  const allowed = useCan('draws.manage');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [values, setValues] = useState<DrawFormValues>(initialValues);
  const [errors, setErrors] = useState<DrawFormErrors>({});
  const [drawNoTouched, setDrawNoTouched] = useState(false);
  const [closeTouched, setCloseTouched] = useState(false);

  const latest = useQuery({
    queryKey: ['draws', { latest: true }],
    queryFn: () => api.admin.draws.list({ limit: 1 }),
    enabled: allowed,
  });
  const suggestedNo = nextDrawNo(latest.data?.items[0]?.drawNo);
  useEffect(() => {
    if (!drawNoTouched && suggestedNo) setValues((v) => ({ ...v, drawNo: suggestedNo }));
  }, [suggestedNo, drawNoTouched]);

  const create = useMutation({
    mutationFn: (body: CreateDrawBody) => api.admin.draws.create(body),
    onSuccess: (draw) => {
      void queryClient.invalidateQueries({ queryKey: ['draws'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`ສ້າງງວດ ${draw.drawNo} ສຳເລັດ`);
      navigate(`/draws/${draw.id}`);
    },
  });

  if (!allowed) return <Navigate to="/draws" replace />;

  const set = <K extends keyof DrawFormValues>(key: K, value: DrawFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setRule = (digits: Digits, patch: Partial<RuleRow>) =>
    setValues((v) => ({ ...v, rules: v.rules.map((r) => (r.digits === digits ? { ...r, ...patch } : r)) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { body, errors: errs } = buildCreateDrawBody(values);
    setErrors(errs);
    if (body) create.mutate(body);
  };

  return (
    <section>
      <PageHeader
        title="ສ້າງງວດໃໝ່"
        subtitle="ເວລາທັງໝົດເປັນເວລາວຽງຈັນ (UTC+7). ງວດຈະເປີດ ແລະ ປິດຂາຍອັດຕະໂນມັດຕາມເວລາທີ່ກຳນົດ."
        actions={
          <Link to="/draws" className="btn btn--secondary">
            ກັບຄືນ
          </Link>
        }
      />
      <form onSubmit={submit} noValidate className="stack">
        <div className="card">
          <div className="form-grid">
            <Field label="ເລກງວດ" htmlFor="drawNo" error={errors.drawNo} help={suggestedNo ? `ແນະນຳ: ${suggestedNo}` : undefined}>
              <input
                id="drawNo"
                className="input mono"
                value={values.drawNo}
                maxLength={20}
                onChange={(e) => {
                  setDrawNoTouched(true);
                  set('drawNo', e.target.value);
                }}
                required
              />
            </Field>
            <Field label="ວັນອອກຫວຍ" htmlFor="drawDate" error={errors.drawDate}>
              <input
                id="drawDate"
                className="input"
                type="date"
                value={values.drawDate}
                onChange={(e) => {
                  const drawDate = e.target.value;
                  setValues((v) => ({
                    ...v,
                    drawDate,
                    salesCloseLocal:
                      !closeTouched && drawDate ? `${drawDate}T${DEFAULT_CLOSE_TIME}` : v.salesCloseLocal,
                  }));
                }}
                required
              />
            </Field>
            <Field label="ເປີດຂາຍ (ເວລາວຽງຈັນ)" htmlFor="salesOpen" error={errors.salesOpen} help={utcHint(values.salesOpenLocal)}>
              <input
                id="salesOpen"
                className="input"
                type="datetime-local"
                value={values.salesOpenLocal}
                onChange={(e) => set('salesOpenLocal', e.target.value)}
                required
              />
            </Field>
            <Field label="ປິດຂາຍ (ເວລາວຽງຈັນ)" htmlFor="salesClose" error={errors.salesClose} help={utcHint(values.salesCloseLocal)}>
              <input
                id="salesClose"
                className="input"
                type="datetime-local"
                value={values.salesCloseLocal}
                onChange={(e) => {
                  setCloseTouched(true);
                  set('salesCloseLocal', e.target.value);
                }}
                required
              />
            </Field>
          </div>
        </div>

        <div className="card">
          <h2 className="card__title">ກົດການຂາຍ ແລະ ອັດຕາຈ່າຍ</h2>
          <p className="muted small">
            ຄ່າເລີ່ມຕົ້ນເປັນພຽງຄຳແນະນຳ ກະລຸນາກວດກ່ອນບັນທຶກ. ຄວາມສ່ຽງສູງສຸດຕໍ່ເລກ = ເພດານ × ອັດຕາຈ່າຍ.
          </p>
          {errors.rules ? <Alert tone="error">{errors.rules}</Alert> : null}
          <div className="table-wrap">
            <table className="table table--form">
              <thead>
                <tr>
                  <th scope="col">ປະເພດ</th>
                  <th scope="col">ເປີດຂາຍ</th>
                  {RULE_FIELDS.map((f) => (
                    <th scope="col" key={f.key}>
                      {f.label}
                    </th>
                  ))}
                  <th scope="col" className="num">
                    ຄວາມສ່ຽງສູງສຸດຕໍ່ເລກ
                  </th>
                </tr>
              </thead>
              <tbody>
                {values.rules.map((r) => {
                  const rowError = errors.ruleRows?.[r.digits];
                  const exposure = Number(r.defaultNumberCap) * Number(r.payoutRate);
                  return (
                    <tr key={r.digits} className={r.enabled ? '' : 'row--disabled'}>
                      <th scope="row" className="nowrap">
                        {r.digits} ໂຕ
                        {rowError ? (
                          <div className="error-text" role="alert">
                            {rowError}
                          </div>
                        ) : null}
                      </th>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={r.enabled}
                          onChange={(e) => setRule(r.digits, { enabled: e.target.checked })}
                          aria-label={`ເປີດຂາຍ ${r.digits} ໂຕ`}
                        />
                      </td>
                      {RULE_FIELDS.map((f) => (
                        <td key={f.key}>
                          <input
                            className="input input--sm num"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={f.step}
                            value={r[f.key]}
                            disabled={!r.enabled}
                            aria-label={`${f.label} ${r.digits} ໂຕ`}
                            aria-invalid={!!rowError}
                            onChange={(e) => setRule(r.digits, { [f.key]: e.target.value })}
                          />
                        </td>
                      ))}
                      <td className="num nowrap">{Number.isFinite(exposure) && r.enabled ? formatNumber(exposure) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ErrorBox error={create.error} />
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={create.isPending}>
            {create.isPending ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກງວດ'}
          </button>
          <Link to="/draws" className="btn btn--secondary">
            ຍົກເລີກ
          </Link>
        </div>
      </form>
    </section>
  );
}
