import { describe, expect, it, vi } from 'vitest';
import { activateBillingSubscription, type ActivateBillingDependencies } from './activate-billing-subscription';

const NOW = new Date('2026-07-31T08:00:00.000Z');

function createDependencies(overrides: Partial<ActivateBillingDependencies> = {}): ActivateBillingDependencies {
  return {
    findAuthorizationIntent: vi.fn().mockResolvedValue({
      id: '5eb940cf-a49f-4737-aa65-e35bca3be1a0',
      amountKrw: 12_000,
      completedAt: null,
      expiresAt: '2026-07-31T08:15:00.000Z',
    }),
    issueBillingKey: vi.fn().mockResolvedValue({
      billingKey: 'billing-secret',
      cardIssuerCode: '11',
      cardNumber: '1234-****-****-5678',
    }),
    saveIssuedBillingKey: vi.fn().mockResolvedValue(undefined),
    dispatchBillingWorker: vi.fn().mockResolvedValue(undefined),
    now: () => NOW,
    ...overrides,
  };
}

describe('activateBillingSubscription', () => {
  it('사용자에게 발급한 customerKey가 아니면 거절한다', async () => {
    const dependencies = createDependencies({
      findAuthorizationIntent: vi.fn().mockResolvedValue(null),
    });

    await expect(
      activateBillingSubscription(
        {
          userId: 'user-1',
          customerKey: 'unknown-customer-key',
          authKey: 'one-time-auth-key',
        },
        dependencies
      )
    ).rejects.toMatchObject({ code: 'INVALID_BILLING_INTENT' });
    expect(dependencies.issueBillingKey).not.toHaveBeenCalled();
  });

  it('만료된 카드 등록 요청은 빌링키 발급 전에 거절한다', async () => {
    const dependencies = createDependencies({
      findAuthorizationIntent: vi.fn().mockResolvedValue({
        id: 'expired-intent',
        amountKrw: 12_000,
        completedAt: null,
        expiresAt: '2026-07-31T07:59:59.000Z',
      }),
    });

    await expect(
      activateBillingSubscription(
        {
          userId: 'user-1',
          customerKey: 'customer-key',
          authKey: 'one-time-auth-key',
        },
        dependencies
      )
    ).rejects.toMatchObject({ code: 'EXPIRED_BILLING_INTENT' });
    expect(dependencies.issueBillingKey).not.toHaveBeenCalled();
  });

  it('intent ID를 멱등키로 사용해 빌링키를 발급하고 서버에 저장한다', async () => {
    const dependencies = createDependencies();

    await activateBillingSubscription(
      {
        userId: 'user-1',
        customerKey: 'customer-key',
        authKey: 'one-time-auth-key',
      },
      dependencies
    );

    expect(dependencies.issueBillingKey).toHaveBeenCalledWith({
      authKey: 'one-time-auth-key',
      customerKey: 'customer-key',
      idempotencyKey: 'billing-intent-5eb940cf-a49f-4737-aa65-e35bca3be1a0',
    });
    expect(dependencies.saveIssuedBillingKey).toHaveBeenCalledWith({
      userId: 'user-1',
      customerKey: 'customer-key',
      billingKey: 'billing-secret',
      cardIssuerCode: '11',
      cardNumber: '1234-****-****-5678',
    });
  });

  it('이미 완료된 intent 콜백은 빌링키를 다시 발급하지 않는다', async () => {
    const dependencies = createDependencies({
      findAuthorizationIntent: vi.fn().mockResolvedValue({
        id: 'completed-intent',
        amountKrw: 12_000,
        completedAt: '2026-07-31T08:01:00.000Z',
        expiresAt: '2026-07-31T08:15:00.000Z',
      }),
    });

    const result = await activateBillingSubscription(
      {
        userId: 'user-1',
        customerKey: 'customer-key',
        authKey: 'one-time-auth-key',
      },
      dependencies
    );

    expect(result).toEqual({ status: 'pending' });
    expect(dependencies.issueBillingKey).not.toHaveBeenCalled();
  });

  it('worker 호출이 실패해도 저장된 결제 대기 상태를 반환한다', async () => {
    const dependencies = createDependencies({
      dispatchBillingWorker: vi.fn().mockRejectedValue(new Error('dispatch failed')),
    });

    const result = await activateBillingSubscription(
      {
        userId: 'user-1',
        customerKey: 'customer-key',
        authKey: 'one-time-auth-key',
      },
      dependencies
    );

    expect(result).toEqual({ status: 'pending' });
  });
});
