import { describe, expect, it } from 'vitest';
import { createBillingPlanHandler } from './billing-plan-handler';

describe('createBillingPlanHandler', () => {
  it('월 구독 가격과 결제 주기를 공개한다', async () => {
    const handler = createBillingPlanHandler(12_000);

    const response = await handler(new Request('https://drop.example.com/api/billing/plan'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      planCode: 'pro',
      amountKrw: 12_000,
      currency: 'KRW',
      interval: 'month',
    });
  });

  it('GET 이외의 요청을 거부한다', async () => {
    const handler = createBillingPlanHandler(12_000);

    const response = await handler(
      new Request('https://drop.example.com/api/billing/plan', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(405);
  });
});
