import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import type { AdminDraw, Role } from '../../api/types';
import { ToastProvider } from '../../components/Toast';
import { type ResultApi, ResultPanel } from './ResultPanel';

const baseDraw: AdminDraw = {
  id: 7,
  drawNo: '0123',
  drawDate: '2026-10-19',
  salesOpenAt: '2026-10-17T01:00:00Z',
  salesCloseAt: '2026-10-19T13:00:00Z',
  status: 'closed',
  resultNumber: null,
  resultedAt: null,
  rules: [{ digits: 2, payoutRate: 60, minAmount: 1000, maxPerLine: 100000, defaultNumberCap: 1000000 }],
  serverTime: '2026-10-19T13:30:00Z',
  pendingResult: null,
  hasPendingResult: false,
  resultEnteredBy: null,
  stats: { sales: 1500000, tickets: 42 },
};

const MAKER = { id: 3, role: 'admin' as Role };
const CHECKER = { id: 4, role: 'admin' as Role };

/** Reads the draw from the query cache like DrawDetailPage does, so cache updates re-render. */
function Harness({ user, resultApi }: { user: { id: number; role: Role }; resultApi: ResultApi }) {
  const q = useQuery<AdminDraw>({ queryKey: ['draw', 7], queryFn: () => Promise.reject(new Error('no fetch in test')), staleTime: Infinity });
  return q.data ? <ResultPanel draw={q.data} user={user} resultApi={resultApi} /> : null;
}

function renderPanel(draw: AdminDraw, user: { id: number; role: Role }, overrides: Partial<ResultApi> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['draw', 7], draw);
  const resultApi: ResultApi = {
    enterResult: vi.fn(),
    approveResult: vi.fn(),
    rejectResult: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Harness user={user} resultApi={resultApi} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, resultApi, queryClient };
}

describe('ResultPanel — maker step', () => {
  it('lets an admin enter a 6-digit result after confirmation, then shows the waiting state', async () => {
    const enterResult = vi.fn(async (_id: number, n: string) => ({
      ...baseDraw,
      hasPendingResult: true,
      pendingResult: n, // the maker gets the number back
      resultEnteredBy: MAKER.id,
    }));
    const { resultApi } = renderPanel(baseDraw, MAKER, { enterResult });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('ເລກທີ່ອອກ (6 ຫຼັກ)'), '48-2175');
    await user.click(screen.getByRole('button', { name: 'ບັນທຶກຜົນ' }));
    const dialog = await screen.findByRole('dialog', { name: 'ຢືນຢັນການບັນທຶກຜົນ' });
    await user.click(within(dialog).getByRole('button', { name: 'ບັນທຶກຜົນ' }));

    await waitFor(() => expect(resultApi.enterResult).toHaveBeenCalledWith(7, '482175'));
    expect(await screen.findByText('ລໍຖ້າແອັດມິນອີກຄົນຢືນຢັນ')).toBeInTheDocument();
    expect(screen.queryByLabelText('ເລກທີ່ອອກ (6 ຫຼັກ)')).not.toBeInTheDocument();
  });

  it('rejects input that is not 6 digits without calling the API', async () => {
    const { resultApi } = renderPanel(baseDraw, MAKER);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('ເລກທີ່ອອກ (6 ຫຼັກ)'), '4821');
    await user.click(screen.getByRole('button', { name: 'ບັນທຶກຜົນ' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ກະລຸນາໃສ່ເລກ 6 ຫຼັກ');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(resultApi.enterResult).not.toHaveBeenCalled();
  });

  it('the maker cannot approve their own result', () => {
    renderPanel({ ...baseDraw, hasPendingResult: true, pendingResult: '482175', resultEnteredBy: MAKER.id }, MAKER);
    expect(screen.getByText('ລໍຖ້າແອັດມິນອີກຄົນຢືນຢັນ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ຢືນຢັນຜົນ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ປະຕິເສດຜົນ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('ResultPanel — checker step', () => {
  // What the API sends to a different admin: hasPendingResult true, pendingResult null.
  const pendingForChecker: AdminDraw = { ...baseDraw, hasPendingResult: true, pendingResult: null, resultEnteredBy: MAKER.id };

  it('shows an empty input and never displays the pending number, even if it is present in the data', () => {
    renderPanel({ ...pendingForChecker, pendingResult: '482175' }, CHECKER);
    const input = screen.getByLabelText('ພິມເລກທີ່ອອກອີກຄັ້ງ (6 ຫຼັກ)') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(document.body.textContent).not.toContain('482175');
  });

  it('approves with the re-typed number and shows the settlement summary', async () => {
    const approveResult = vi.fn(async () => ({
      draw: { ...baseDraw, status: 'resulted' as const, resultNumber: '482175', resultedAt: '2026-10-19T13:40:00Z' },
      settlement: { winners: 12, totalWin: 3600000, autoPaid: 11, pendingPayouts: 1 },
    }));
    const { resultApi } = renderPanel(pendingForChecker, CHECKER, { approveResult });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('ພິມເລກທີ່ອອກອີກຄັ້ງ (6 ຫຼັກ)'), '482175');
    await user.click(screen.getByRole('button', { name: 'ຢືນຢັນຜົນ' }));
    const dialog = await screen.findByRole('dialog', { name: 'ຢືນຢັນຜົນ ແລະ ຄິດໄລ່ລາງວັນ' });
    await user.click(within(dialog).getByRole('button', { name: 'ຢືນຢັນ ແລະ ອອກຜົນ' }));

    await waitFor(() => expect(resultApi.approveResult).toHaveBeenCalledWith(7, '482175'));
    expect(await screen.findByText('ສະຫຼຸບການຄິດໄລ່ລາງວັນ')).toBeInTheDocument();
    const summary = screen.getByText('ສະຫຼຸບການຄິດໄລ່ລາງວັນ').closest('.settlement') as HTMLElement;
    expect(summary).toHaveTextContent('12');
    expect(summary).toHaveTextContent('3,600,000 ກີບ');
    expect(summary).toHaveTextContent('11');
    // the draw is now resulted: the big result digits are shown
    expect(screen.getByLabelText('ເລກທີ່ອອກ 482175')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ຢືນຢັນຜົນ' })).not.toBeInTheDocument();
  });

  it('shows the server message when the numbers do not match', async () => {
    const approveResult = vi.fn(async () => {
      throw new ApiError(409, 'CONFLICT', 'ເລກທີ່ຢືນຢັນບໍ່ກົງກັບເລກທີ່ປ້ອນ, ກະລຸນາກວດຄືນ');
    });
    renderPanel(pendingForChecker, CHECKER, { approveResult });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('ພິມເລກທີ່ອອກອີກຄັ້ງ (6 ຫຼັກ)'), '111111');
    await user.click(screen.getByRole('button', { name: 'ຢືນຢັນຜົນ' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'ຢືນຢັນ ແລະ ອອກຜົນ' }));
    expect(await screen.findByText('ເລກທີ່ຢືນຢັນບໍ່ກົງກັບເລກທີ່ປ້ອນ, ກະລຸນາກວດຄືນ')).toBeInTheDocument();
    expect(screen.getByLabelText('ພິມເລກທີ່ອອກອີກຄັ້ງ (6 ຫຼັກ)')).toBeInTheDocument();
  });

  it('can reject the pending result after confirmation', async () => {
    const rejectResult = vi.fn(async () => ({ ...baseDraw }));
    const { resultApi } = renderPanel(pendingForChecker, CHECKER, { rejectResult });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'ປະຕິເສດຜົນ' }));
    const dialog = await screen.findByRole('dialog', { name: 'ປະຕິເສດຜົນທີ່ປ້ອນໄວ້' });
    await user.click(within(dialog).getByRole('button', { name: 'ປະຕິເສດຜົນ' }));
    await waitFor(() => expect(resultApi.rejectResult).toHaveBeenCalledWith(7));
    // back to the maker step for anyone
    expect(await screen.findByLabelText('ເລກທີ່ອອກ (6 ຫຼັກ)')).toBeInTheDocument();
  });

  it('is read-only for finance and auditor', () => {
    renderPanel(pendingForChecker, { id: 9, role: 'auditor' });
    expect(screen.getByText('ມີຜົນທີ່ປ້ອນແລ້ວ ລໍຖ້າແອັດມິນອີກຄົນຢືນຢັນ.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
