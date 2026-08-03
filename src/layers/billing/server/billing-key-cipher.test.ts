import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createBillingKeyCipher } from './billing-key-cipher';

describe('billing key cipher', () => {
  it('AES-256-GCM으로 암호화한 빌링키를 다시 복호화한다', () => {
    const cipher = createBillingKeyCipher(randomBytes(32).toString('base64'));

    const encryptedBillingKey = cipher.encrypt('billing-secret');

    expect(encryptedBillingKey).not.toContain('billing-secret');
    expect(cipher.decrypt(encryptedBillingKey)).toBe('billing-secret');
  });

  it('32바이트가 아닌 키를 거절한다', () => {
    expect(() => createBillingKeyCipher(randomBytes(16).toString('base64'))).toThrow('BILLING_KEY_ENCRYPTION_KEY');
  });
});
