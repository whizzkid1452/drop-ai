import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { BillingProviderError } from './billing-renewal-worker';
import { createTossBillingGateway } from './toss-billing-gateway';

describe('Toss billing gateway', () => {
  it('시크릿 키와 멱등키로 빌링키를 발급한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        billingKey: 'billing-key',
        customerKey: 'customer-key',
        card: { issuerCode: '11', number: '1234-****-****-5678' },
      })
    );
    const gateway = createTossBillingGateway({
      secretKey: 'test_sk_secret',
      fetch: fetchMock,
    });

    const result = await gateway.issueBillingKey({
      authKey: 'auth-key',
      customerKey: 'customer-key',
      idempotencyKey: 'billing-intent-id',
    });

    expect(result).toEqual({
      billingKey: 'billing-key',
      cardIssuerCode: '11',
      cardNumber: '1234-****-****-5678',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tosspayments.com/v1/billing/authorizations/issue',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: `Basic ${Buffer.from('test_sk_secret:').toString('base64')}`,
          'idempotency-key': 'billing-intent-id',
        }),
        body: JSON.stringify({ authKey: 'auth-key', customerKey: 'customer-key' }),
      })
    );
  });

  it('서버에서 정한 금액과 주문 정보로 자동결제를 승인한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        paymentKey: 'payment-key',
        approvedAt: '2026-07-31T17:00:00+09:00',
      })
    );
    const gateway = createTossBillingGateway({
      secretKey: 'test_sk_secret',
      fetch: fetchMock,
    });

    await gateway.chargeBillingKey({
      amountKrw: 12_000,
      billingKey: 'billing/key',
      customerKey: 'customer-key',
      idempotencyKey: 'order-id',
      orderId: 'order-id',
      orderName: 'Drop Pro 월간 구독',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tosspayments.com/v1/billing/billing%2Fkey',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          amount: 12_000,
          customerKey: 'customer-key',
          orderId: 'order-id',
          orderName: 'Drop Pro 월간 구독',
        }),
      })
    );
  });

  it('명시적인 4xx 결제 거절은 재시도 불가 오류로 변환한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ code: 'REJECT_CARD_COMPANY', message: '카드사에서 거절했습니다.' }, { status: 400 })
      );
    const gateway = createTossBillingGateway({
      secretKey: 'test_sk_secret',
      fetch: fetchMock,
    });

    await expect(
      gateway.chargeBillingKey({
        amountKrw: 12_000,
        billingKey: 'billing-key',
        customerKey: 'customer-key',
        idempotencyKey: 'order-id',
        orderId: 'order-id',
        orderName: 'Drop Pro 월간 구독',
      })
    ).rejects.toEqual(new BillingProviderError('REJECT_CARD_COMPANY', false));
  });

  it('네트워크 오류는 같은 멱등키로 재확인할 수 있는 오류로 변환한다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const gateway = createTossBillingGateway({
      secretKey: 'test_sk_secret',
      fetch: fetchMock,
    });

    await expect(
      gateway.chargeBillingKey({
        amountKrw: 12_000,
        billingKey: 'billing-key',
        customerKey: 'customer-key',
        idempotencyKey: 'order-id',
        orderId: 'order-id',
        orderName: 'Drop Pro 월간 구독',
      })
    ).rejects.toEqual(new BillingProviderError('UNKNOWN_RESULT', true));
  });

  it('본문이 없는 빌링키 삭제 응답을 처리한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const gateway = createTossBillingGateway({
      secretKey: 'test_sk_secret',
      fetch: fetchMock,
    });

    await expect(gateway.deleteBillingKey('billing-key')).resolves.toBeUndefined();
  });
});
