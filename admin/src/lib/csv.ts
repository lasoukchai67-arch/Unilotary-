import type { DrawReport } from '../api/types';
import { drawStatusLabel } from './labels';

export type CsvCell = string | number | null | undefined;

/** Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection in text cells. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = value;
  if (/^[=+@\t\r]/.test(s) || /^-[^\d]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** UTF-8 byte order mark so Excel opens Lao text correctly. */
export const CSV_BOM = '﻿';

/** Per-draw report as CSV. Amounts are plain integers (kip) so spreadsheets can sum them. */
export function drawReportCsv(r: DrawReport): string {
  const rows: CsvCell[][] = [
    ['ລາຍງານງວດ', r.drawNo],
    ['ສະຖານະ', drawStatusLabel(r.status)],
    ['ເລກທີ່ອອກ', r.resultNumber ?? ''],
    [],
    ['ລາຍການ', 'ຈຳນວນ (ກີບ)'],
    ['ຍອດຂາຍລວມ', r.sales.total],
    ['ຈຳນວນບິນ', r.sales.tickets],
    ['ລາງວັນທັງໝົດ', r.payouts.total],
    ['ລາງວັນຈ່າຍແລ້ວ', r.payouts.paid],
    ['ລາງວັນລໍຖ້າຈ່າຍ', r.payouts.pending],
    ['ຄ່າຄອມມິດຊັ່ນ', r.commissions],
    ['ກຳໄລສຸດທິ', r.net],
    [],
    ['ຈຳນວນໂຕ', 'ຈຳນວນແຖວ', 'ຍອດຂາຍ (ກີບ)'],
    ...r.sales.byDigits.map((d) => [`${d.digits} ໂຕ`, d.lines, d.amount] as CsvCell[]),
  ];
  return toCsv(rows);
}

/** Trigger a browser download of text content. */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
