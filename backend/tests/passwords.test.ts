import { describe, expect, it } from 'vitest';
import {
  generateTemporaryPassword,
  hashPassword,
  verifyPassword
} from '../src/lib/passwords.js';

describe('generateTemporaryPassword', () => {
  it('generates a 10-char alphanumeric password', () => {
    const pw = generateTemporaryPassword();
    expect(pw).toHaveLength(10);
    expect(pw).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('generates unique values', () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});

describe('hashPassword/verifyPassword', () => {
  it('verifies the correct password and rejects wrong ones', async () => {
    const hash = await hashPassword('secret123');
    await expect(verifyPassword('secret123', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-pass', hash)).resolves.toBe(false);
  });
});
