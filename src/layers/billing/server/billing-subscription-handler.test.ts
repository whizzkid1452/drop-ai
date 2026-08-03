import { describe, expect, it, vi } from 'vitest';
import { createBillingSubscriptionHandler } from './billing-subscription-handler';

describe('billing subscription handler', () => {
  it('토큰에서 확인한 사용자의 공개 가능한 구독 정보만 반환한다', async () => {
    const readBillingSubscription = vi.fn().mockResolvedValue({
      status: 'active',
      amountKrw: 12_000,
      currentPeriodEnd: '2026-08-31T08:00:00.000Z',
      cardLastFour: '5678',
    });
    const handler = createBillingSubscriptionHandler({
      verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'user-1' }),
      readBillingSubscription,
    });

    const response = await handler(
      new Request('https://drop.example.com/api/billing/subscription', {
        headers: { authorization: 'Bearer access-token' },
      })
    );

    expect(readBillingSubscription).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toEqual({
      status: 'active',
      amountKrw: 12_000,
      currentPeriodEnd: '2026-08-31T08:00:00.000Z',
      cardLastFour: '5678',
    });
  });

  it('구독이 없으면 none 상태를 반환한다', async () => {
    const handler = createBillingSubscriptionHandler({
      verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'user-1' }),
      readBillingSubscription: vi.fn().mockResolvedValue(null),
    });

    const response = await handler(
      new Request('https://drop.example.com/api/billing/subscription', {
        headers: { authorization: 'Bearer access-token' },
      })
    );

    await expect(response.json()).resolves.toEqual({
      status: 'none',
      amountKrw: null,
      currentPeriodEnd: null,
      cardLastFour: null,
    });
  });
});
