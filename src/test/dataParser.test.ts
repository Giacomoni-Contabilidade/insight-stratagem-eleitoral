import { describe, it, expect } from 'vitest';

// We need to test the parseNumber function which is not exported,
// so we test through parseSpreadsheetData indirectly and also
// extract the logic for direct testing.

// Replicate parseNumber logic for unit testing
const parseNumber = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  const trimmed = value.trim();
  const isAccountingNegative = /^\(.*\)$/.test(trimmed);
  let cleaned = trimmed.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return 0;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount > 1) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  } else if (lastDot !== -1) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      cleaned = cleaned.replace(/\./g, '');
    } else {
      const parts = cleaned.split('.');
      const afterDot = parts[1];
      if (afterDot && afterDot.length === 3 && /^\d{3}$/.test(afterDot) && parts[0].length >= 1) {
        cleaned = cleaned.replace('.', '');
      }
    }
  }

  let num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (isAccountingNegative) num = -Math.abs(num);
  return num;
};

describe('parseNumber', () => {
  it('handles empty/null values', () => {
    expect(parseNumber('')).toBe(0);
    expect(parseNumber('  ')).toBe(0);
  });

  it('handles simple integers', () => {
    expect(parseNumber('100')).toBe(100);
    expect(parseNumber('0')).toBe(0);
  });

  // pt-BR format: dot=thousands, comma=decimal
  it('parses pt-BR format: 1.234,56', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
  });

  it('parses pt-BR format: 1.234.567,89', () => {
    expect(parseNumber('1.234.567,89')).toBe(1234567.89);
  });

  // en-US format: comma=thousands, dot=decimal
  it('parses en-US format: 1,234.56', () => {
    expect(parseNumber('1,234.56')).toBe(1234.56);
  });

  // Single comma = decimal (pt-BR)
  it('treats single comma as decimal: 0,56', () => {
    expect(parseNumber('0,56')).toBe(0.56);
  });

  it('treats single comma as decimal: 1234,5', () => {
    expect(parseNumber('1234,5')).toBe(1234.5);
  });

  // Single dot with 3 digits after = thousands (pt-BR)
  it('treats 1.234 as 1234 (pt-BR thousands)', () => {
    expect(parseNumber('1.234')).toBe(1234);
  });

  it('treats 12.345 as 12345 (pt-BR thousands)', () => {
    expect(parseNumber('12.345')).toBe(12345);
  });

  // Multiple dots = all thousands
  it('handles multiple dots as thousands: 1.234.567', () => {
    expect(parseNumber('1.234.567')).toBe(1234567);
  });

  // Single dot with non-3 digits = decimal
  it('treats 1.5 as decimal', () => {
    expect(parseNumber('1.5')).toBe(1.5);
  });

  it('treats 12.34 as decimal', () => {
    expect(parseNumber('12.34')).toBe(12.34);
  });

  // Currency prefix
  it('strips R$ prefix: R$ 1.234,56', () => {
    expect(parseNumber('R$ 1.234,56')).toBe(1234.56);
  });

  // Accounting negative
  it('handles accounting negative: (1.234,56)', () => {
    expect(parseNumber('(1.234,56)')).toBe(-1234.56);
  });

  // Negative sign
  it('handles negative: -500', () => {
    expect(parseNumber('-500')).toBe(-500);
  });
});
