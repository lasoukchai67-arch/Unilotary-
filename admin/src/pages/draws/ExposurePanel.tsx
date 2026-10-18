import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { api } from '../../api';
import type { AdminDraw, AdminDigitRule, Digits, ExposureItem, NumberLimitBody } from '../../api/types';
import { useCan } from '../../auth/RequireAuth';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Badge, Empty, ErrorBox, Field, Loading, Money } from '../../components/ui';
import { formatDateTime } from '../../lib/datetime';
import { ALL_DIGITS } from '../../lib/drawForm';
import { formatKip, formatNumber, formatPercent, formatRate, parseKip, percentOf } from '../../lib/format';
import { sanitizeDigits } from '../../lib/resultFlow';

const REFRESH_MS = 5000;

export function ExposurePanel({ draw }: { draw: AdminDraw }) {
  const firstRule = draw.rules.map((r) => r.digits).sort()[0] ?? 2;
  const [digits, setDigits] = useState<Digits>(firstRule);
  const [limit, setLimit] = useState(50);
  const [editing, setEditing] = useState<{ number: string; item?: ExposureItem } | null>(null);
  const [lookup, setLookup] = useState('');
  const canEdit = useCan('risk.manage') && (draw.status === 'scheduled' || draw.status === 'open');
  const live = draw.status === 'open';
  const rule = draw.rules.find((r) => r.digits === digits);
  const toast = useToast();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ['exposure', draw.id, digits, limit],
    queryFn: () => api.admin.draws.exposure(draw.id, digits, limit),
    enabled: !!rule,
    refetchInterval: live ? REFRESH_MS : false,
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: (item: ExposureItem) =>
      api.admin.draws.setNumberLimit(draw.id, item.number, {
        // Keep the current effective cap/rate; only flip `closed`.
        cap: item.cap,
        payoutRate: item.payoutRate,
        closed: !item.closed,
      }),
    onSuccess: (_r, item) => {
      toast(item.closed ? `ເປີດຂາຍເລກ ${item.number} ແລ້ວ` : `ປິດເລກ ${item.number} ແລ້ວ`);
      void queryClient.invalidateQueries({ queryKey: ['exposure', draw.id] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'ຜິດພາດ', 'error'),
  });

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = ALL_DIGITS.indexOf(digits);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (i + 1) % ALL_DIGITS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + ALL_DIGITS.length) % ALL_DIGITS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ALL_DIGITS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setDigits(ALL_DIGITS[next]);
    document.getElementById(`exp-tab-${ALL_DIGITS[next]}`)?.focus();
  };

  const openLookup = (e: FormEvent) => {
    e.preventDefault();
    if (lookup.length !== digits) return;
    const item = q.data?.items.find((x) => x.number === lookup);
    setEditing({ number: lookup, item });
  };

  return (
    <section className="card" aria-labelledby="exposure-title">
      <div className="card__head">
        <h2 className="card__title" id="exposure-title">
          ຄວາມສ່ຽງ / ຍອດຂາຍຕໍ່ເລກ
        </h2>
        <div className="muted small" aria-live="off">
          {live ? `ອັບເດດອັດຕະໂນມັດທຸກ ${REFRESH_MS / 1000} ວິ · ` : ''}
          {q.dataUpdatedAt ? `ອັບເດດລ່າສຸດ ${formatDateTime(new Date(q.dataUpdatedAt).toISOString())}` : ''}
          {q.isFetching ? ' · ກຳລັງໂຫຼດ...' : ''}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="ປະເພດເລກ">
        {ALL_DIGITS.map((d) => (
          <button
            key={d}
            id={`exp-tab-${d}`}
            type="button"
            role="tab"
            className="tab"
            aria-selected={digits === d}
            aria-controls="exp-panel"
            tabIndex={digits === d ? 0 : -1}
            onClick={() => setDigits(d)}
            onKeyDown={onTabKey}
          >
            {d} ໂຕ
          </button>
        ))}
      </div>

      <div id="exp-panel" role="tabpanel" aria-labelledby={`exp-tab-${digits}`} className="tabpanel">
        {!rule ? (
          <Empty>ງວດນີ້ບໍ່ໄດ້ເປີດຂາຍເລກ {digits} ໂຕ</Empty>
        ) : (
          <>
            <div className="toolbar">
              <span className="muted small">
                ຄ່າເລີ່ມຕົ້ນ: ອັດຕາ {formatRate(rule.payoutRate)} · ເພດານ {formatKip(rule.defaultNumberCap)}
              </span>
              <div className="field field--inline">
                <label htmlFor="exp-limit">ສະແດງ</label>
                <select id="exp-limit" className="select" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                  <option value={50}>50 ເລກ</option>
                  <option value={100}>100 ເລກ</option>
                  <option value={200}>200 ເລກ</option>
                </select>
              </div>
              {canEdit ? (
                <form className="inline-form" onSubmit={openLookup}>
                  <label htmlFor="exp-lookup" className="sr-only">
                    ເລກທີ່ຕ້ອງການຕັ້ງຄ່າ
                  </label>
                  <input
                    id="exp-lookup"
                    className="input input--sm mono"
                    inputMode="numeric"
                    placeholder={'0'.repeat(digits)}
                    maxLength={digits}
                    value={lookup}
                    onChange={(e) => setLookup(sanitizeDigits(e.target.value, digits))}
                  />
                  <button type="submit" className="btn btn--secondary btn--sm" disabled={lookup.length !== digits}>
                    ຕັ້ງຄ່າເລກ
                  </button>
                </form>
              ) : null}
            </div>

            {q.isPending ? <Loading /> : null}
            <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
            {q.data && q.data.items.length === 0 ? <Empty>ຍັງບໍ່ມີຍອດຂາຍ</Empty> : null}
            {q.data && q.data.items.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">ເລກ</th>
                      <th scope="col" className="num">
                        ຂາຍແລ້ວ
                      </th>
                      <th scope="col" className="num">
                        ເພດານ
                      </th>
                      <th scope="col">ເຕັມ</th>
                      <th scope="col" className="num">
                        ອັດຕາຈ່າຍ
                      </th>
                      <th scope="col" className="num">
                        ຄວາມສ່ຽງ (ຈ່າຍສູງສຸດ)
                      </th>
                      <th scope="col">ສະຖານະ</th>
                      {canEdit ? (
                        <th scope="col">
                          <span className="sr-only">ການດຳເນີນການ</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.items.map((item) => {
                      const pct = percentOf(item.sold, item.cap);
                      const level = pct === null ? '' : pct >= 90 ? ' bar--high' : pct >= 70 ? ' bar--mid' : '';
                      return (
                        <tr key={item.number} className={item.closed ? 'row--muted' : ''}>
                          <td className="mono strong">{item.number}</td>
                          <td className="num">{formatNumber(item.sold)}</td>
                          <td className="num">{formatNumber(item.cap)}</td>
                          <td>
                            <div className="bar-cell">
                              <div
                                className={`bar${level}`}
                                role="progressbar"
                                aria-label={`ເລກ ${item.number} ຂາຍແລ້ວ`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={pct === null ? undefined : Math.round(pct)}
                              >
                                <span style={{ width: `${pct ?? 0}%` }} />
                              </div>
                              <span className="small">{formatPercent(pct)}</span>
                            </div>
                          </td>
                          <td className="num">{formatRate(item.payoutRate)}</td>
                          <td className="num">
                            <Money value={item.exposure} unit={false} />
                          </td>
                          <td>{item.closed ? <Badge tone="dark">ປິດເລກ</Badge> : <Badge tone="mint">ເປີດ</Badge>}</td>
                          {canEdit ? (
                            <td className="nowrap">
                              <button
                                type="button"
                                className={`btn btn--sm ${item.closed ? 'btn--secondary' : 'btn--danger-outline'}`}
                                disabled={toggle.isPending}
                                onClick={() => toggle.mutate(item)}
                              >
                                {item.closed ? 'ເປີດເລກ' : 'ປິດເລກ'}
                              </button>{' '}
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => setEditing({ number: item.number, item })}
                              >
                                ແກ້ໄຂ
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>

      {editing && rule ? (
        <NumberLimitDialog
          drawId={draw.id}
          number={editing.number}
          item={editing.item}
          rule={rule}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setLookup('');
            toast(`ບັນທຶກການຕັ້ງຄ່າເລກ ${editing.number} ແລ້ວ`);
            void queryClient.invalidateQueries({ queryKey: ['exposure', draw.id] });
          }}
        />
      ) : null}
    </section>
  );
}

function NumberLimitDialog({
  drawId,
  number,
  item,
  rule,
  onClose,
  onSaved,
}: {
  drawId: number;
  number: string;
  item?: ExposureItem;
  rule: AdminDigitRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cap, setCap] = useState(item ? String(item.cap) : '');
  const [rate, setRate] = useState(item ? String(item.payoutRate) : '');
  const [closed, setClosed] = useState(item?.closed ?? false);
  const [error, setError] = useState<string>();

  const save = useMutation({
    mutationFn: (body: NumberLimitBody) => api.admin.draws.setNumberLimit(drawId, number, body),
    onSuccess: onSaved,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let capValue: number | null = null;
    if (cap.trim()) {
      capValue = parseKip(cap);
      if (capValue === null) return setError('ເພດານຕ້ອງເປັນຈຳນວນເຕັມ (ກີບ)');
      if (item && capValue < item.sold) {
        return setError(`ເພດານຕ້ອງບໍ່ຕ່ຳກວ່າຍອດທີ່ຂາຍແລ້ວ (${formatKip(item.sold)}). ຖ້າຕ້ອງການຢຸດຂາຍ ໃຫ້ປິດເລກ.`);
      }
    }
    let rateValue: number | null = null;
    if (rate.trim()) {
      const t = rate.trim().replace(/,/g, '');
      if (!/^\d+(\.\d{1,2})?$/.test(t) || Number(t) <= 0) return setError('ອັດຕາຈ່າຍຕ້ອງຫຼາຍກວ່າ 0');
      rateValue = Number(t);
    }
    setError(undefined);
    save.mutate({ cap: capValue, payoutRate: rateValue, closed });
  };

  return (
    <Modal title={`ຕັ້ງຄ່າເລກ ${number}`} onClose={onClose} closeDisabled={save.isPending}>
      <form onSubmit={submit} noValidate>
        {item ? (
          <p className="muted small">
            ຂາຍແລ້ວ {formatKip(item.sold)} · ຄວາມສ່ຽງ {formatKip(item.exposure)}
          </p>
        ) : (
          <p className="muted small">ເລກນີ້ບໍ່ຢູ່ໃນລາຍການຂ້າງເທິງ. ການບັນທຶກຈະແທນທີ່ການຕັ້ງຄ່າເດີມຂອງເລກນີ້ (ຖ້າມີ).</p>
        )}
        <Field
          label="ເພດານຍອດຂາຍ (ກີບ)"
          htmlFor="limit-cap"
          help={`ປ່ອຍວ່າງ = ໃຊ້ຄ່າເລີ່ມຕົ້ນ ${formatKip(rule.defaultNumberCap)}`}
        >
          <input
            id="limit-cap"
            className="input num"
            inputMode="numeric"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            data-autofocus
          />
        </Field>
        <Field label="ອັດຕາຈ່າຍ (×)" htmlFor="limit-rate" help={`ປ່ອຍວ່າງ = ໃຊ້ຄ່າເລີ່ມຕົ້ນ ${formatRate(rule.payoutRate)}`}>
          <input
            id="limit-rate"
            className="input num"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </Field>
        <div className="field field--check">
          <input id="limit-closed" type="checkbox" className="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
          <label htmlFor="limit-closed">ປິດເລກນີ້ (ບໍ່ຮັບຊື້ອີກ)</label>
        </div>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
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
