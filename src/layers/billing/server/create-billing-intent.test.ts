import { describe, expect, it, vi } from 'vitest';
import { createBillingIntent, type CreateBillingIntentDependencies } from './create-billing-intent';

const NOW = new Date('2026-07-31T08:00:00.000Z');

function createDependencies(overrides: Partial<CreateBillingIntentDependencies> = {}): CreateBillingIntentDependencies {
  return {
    createCustomerKey: () => '151af152-7f86-4fe6-8656-47d306bf7a11',
    saveAuthorizationIntent: vi.fn().mockResolvedValue(undefined),
    now: () => NOW,
    clientKey: 'test_ck_client',
    amountKrw: 12_000,
    siteUrl: 'https://drop.example.com/',
    ...overrides,
  };
}

describe('createBillingIntent', () => {
  it('로그인 사용자와 무작위 customerKey를 15분 동안 연결한다', async () => {
    const dependencies = createDependencies();

    const result = await createBillingIntent('user-1', dependencies);

    expect(dependencies.saveAuthorizationIntent).toHaveBeenCalledWith({
      userId: 'user-1',
      customerKey: '151af152-7f86-4fe6-8656-47d306bf7a11',
      amountKrw: 12_000,
      expiresAt: '2026-07-31T08:15:00.000Z',
    });
    expect(result).toEqual({
      clientKey: 'test_ck_client',
      customerKey: '151af152-7f86-4fe6-8656-47d306bf7a11',
      amountKrw: 12_000,
      successUrl: 'https://drop.example.com/billing/success',
      failUrl: 'https://drop.example.com/billing/fail',
    });
  });
});
