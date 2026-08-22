import { describe, expect, it } from 'vitest';
import { buildLoginId, normalizeNamePart } from '../src/lib/login-id.js';

describe('normalizeNamePart', () => {
  it('strips non-alphabetic characters and uppercases', () => {
    expect(normalizeNamePart("O'connor")).toBe('OC');
    expect(normalizeNamePart('jean-pierre')).toBe('JE');
  });

  it('pads short values with X', () => {
    expect(normalizeNamePart('A')).toBe('AX');
    expect(normalizeNamePart('')).toBe('XX');
  });

  it('truncates beyond two letters', () => {
    expect(normalizeNamePart('Jonathan')).toBe('JO');
  });
});

describe('buildLoginId', () => {
  it('matches the spec example format', () => {
    expect(buildLoginId('OI', 'John', 'Doe', 2026, 1)).toBe('OIJODO20260001');
  });

  it('pads serial to four digits', () => {
    expect(buildLoginId('AB', 'Sid', 'Ray', 2025, 42)).toBe('ABSIRA20250042');
  });
});
