import { describe, expect, it } from 'vitest';

import { formatPhone, phoneDigits, validatePhone } from '../src/phone';

describe('formatPhone', () => {
  it('builds the format up as digits are typed', () => {
    expect(['5', '55', '555', '5551', '55512', '555123', '5551234', '5551234567'].map(formatPhone)).toEqual([
      '(5', '(55', '(555', '(555) 1', '(555) 12', '(555) 123', '(555) 123-4', '(555) 123-4567',
    ]);
  });

  it('is empty for nothing and for no digits', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('abc')).toBe('');
  });

  it('gives the same answer when its own output is fed back in', () => {
    for (const typed of ['5', '5551', '555123', '5551234567']) {
      expect(formatPhone(formatPhone(typed))).toBe(formatPhone(typed));
    }
  });

  it('re-forms around the digits left after a backspace over a bracket or dash', () => {
    expect(formatPhone('(555 123-4567')).toBe('(555) 123-4567');
    expect(formatPhone('(555) 1234567')).toBe('(555) 123-4567');
    expect(formatPhone('(555')).toBe('(555');
  });

  it('lets in no more than ten digits', () => {
    expect(formatPhone('55512345678999')).toBe('(555) 123-4567');
  });

  it('drops letters and symbols', () => {
    expect(formatPhone('5a5-5.1x2')).toBe('(555) 12');
  });

  it('drops a pasted country code', () => {
    expect(formatPhone('+1 (555) 123-4567')).toBe('(555) 123-4567');
    expect(formatPhone('15551234567')).toBe('(555) 123-4567');
  });
});

describe('phoneDigits', () => {
  it('keeps a number that legitimately starts with 1 while it is still being typed', () => {
    expect(phoneDigits('1555')).toBe('1555');
  });
});

describe('validatePhone', () => {
  it('accepts blank, since the field is optional', () => {
    expect(validatePhone('')).toBeNull();
  });

  it('accepts ten digits however they are written', () => {
    expect(validatePhone('(555) 123-4567')).toBeNull();
    expect(validatePhone('5551234567')).toBeNull();
  });

  it('refuses a number cut short', () => {
    expect(validatePhone('(555) 123')).toBe('Phone numbers are 10 digits');
  });
});
