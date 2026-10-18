import { describe, expect, it } from 'vitest';
import { bpToPercent, formatKip, formatNumber, formatPercent, formatRate, parseKip, percentOf, percentToBp } from './format';

describe('money formatting (integer kip)', () => {
  it('groups thousands with commas', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1500000)).toBe('1,500,000');
    expect(formatNumber(1234567890123)).toBe('1,234,567,890,123');
  });

  it('formats negative numbers and rounds non-integers', () => {
    expect(formatNumber(-30000)).toBe('-30,000');
    expect(formatNumber(1234.6)).toBe('1,235');
    expect(formatNumber(-0.4)).toBe('0');
  });

  it('adds the kip unit unless disabled', () => {
    expect(formatKip(250000)).toBe('250,000 ກີບ');
    expect(formatKip(250000, { unit: false })).toBe('250,000');
    expect(formatKip(-5000)).toBe('-5,000 ກີບ');
  });

  it('shows a dash for missing values', () => {
    expect(formatKip(null)).toBe('—');
    expect(formatKip(undefined)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('parses typed amounts', () => {
    expect(parseKip('1,500,000')).toBe(1500000);
    expect(parseKip(' 1 500 000 ກີບ ')).toBe(1500000);
    expect(parseKip('0')).toBe(0);
    expect(parseKip('-5')).toBeNull();
    expect(parseKip('12.5')).toBeNull();
    expect(parseKip('abc')).toBeNull();
    expect(parseKip('')).toBeNull();
    expect(parseKip('99999999999999999999')).toBeNull();
  });
});

describe('rates and percentages', () => {
  it('formats payout rates', () => {
    expect(formatRate(60)).toBe('×60');
    expect(formatRate(100000)).toBe('×100,000');
    expect(formatRate(55.5)).toBe('×55.5');
    expect(formatRate(null)).toBe('—');
  });

  it('converts commission basis points <-> percent', () => {
    expect(bpToPercent(0)).toBe('0');
    expect(bpToPercent(250)).toBe('2.5');
    expect(bpToPercent(1000)).toBe('10');
    expect(bpToPercent(1)).toBe('0.01');
    expect(bpToPercent(10000)).toBe('100');
    expect(percentToBp('2.5')).toBe(250);
    expect(percentToBp('2,5')).toBe(250);
    expect(percentToBp('10%')).toBe(1000);
    expect(percentToBp('0.01')).toBe(1);
    expect(percentToBp('100')).toBe(10000);
    expect(percentToBp('100.01')).toBeNull();
    expect(percentToBp('1.234')).toBeNull();
    expect(percentToBp('-1')).toBeNull();
    expect(percentToBp('')).toBeNull();
  });

  it('computes fill percentage for the exposure bar', () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(300, 200)).toBe(100);
    expect(percentOf(5, 0)).toBeNull();
    expect(formatPercent(25)).toBe('25%');
    expect(formatPercent(2.54)).toBe('2.5%');
    expect(formatPercent(null)).toBe('—');
  });
});
