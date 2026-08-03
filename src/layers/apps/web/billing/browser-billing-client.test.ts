import { describe, expect, it, vi } from 'vitest';
import { BrowserBillingClient, BillingClientError, type TossPaymentsLoader } from './browser-billing-client';

const PLAN_RESPONSE = {
  planCode: 'pro',
  amountKrw: 12_000,
  currency: 'KRW',
  interval: 'month',
};

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('BrowserBillingClient', () => {
  it('공개 플랜은 access token 없이 조회한다', async () => {
    const fetch = vi.fn().mockResolvedValue(createJsonResponse(PLAN_RESPONSE));
    const client = new BrowserBillingClient({
      getAccessToken: () => null,
      fetch,
      loadTossPayments: vi.fn(),
    });

    await expect(client.readPlan()).resolves.toEqual(PLAN_RESPONSE);

    expect(fetch).toHaveBeenCalledWith('/api/billing/plan', {
      headers: { accept: 'application/json' },
      method: 'GET',
    });
  });

  it('구독 상태 요청에는 현재 access token만 Authorization 헤더로 전달한다', async () => {
    const fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        status: 'active',
        amountKrw: 12_000,
        currentPeriodEnd: '2026-08-31T00:00:00.000Z',
        cardLastFour: '1234',
      })
    );
    const client = new BrowserBillingClient({
      getAccessToken: () => 'access-token-1',
      fetch,
      loadTossPayments: vi.fn(),
    });

    await client.readSubscription();

    expect(fetch).toHaveBeenCalledWith('/api/billing/subscription', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer access-token-1',
      },
      method: 'GET',
    });
  });

  it('access token이 없으면 인증 API를 호출하지 않는다', async () => {
    const fetch = vi.fn();
    const client = new BrowserBillingClient({
      getAccessToken: () => null,
      fetch,
      loadTossPayments: vi.fn(),
    });

    await expect(client.readSubscription()).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('서버가 만든 customerKey와 callback URL로 토스 카드 등록창을 연다', async () => {
    const requestBillingAuth = vi.fn().mockResolvedValue(undefined);
    const payment = vi.fn(() => ({ requestBillingAuth }));
    const loadTossPayments: TossPaymentsLoader = vi.fn().mockResolvedValue({ payment });
    const fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        clientKey: 'test_ck_client',
        customerKey: 'd1041d9d-3f23-42a4-88f6-26ef777e9dbb',
        amountKrw: 12_000,
        successUrl: 'https://drop.example.com/billing/success',
        failUrl: 'https://drop.example.com/billing/fail',
      })
    );
    const client = new BrowserBillingClient({
      getAccessToken: () => 'access-token-1',
      fetch,
      loadTossPayments,
    });

    await client.requestBillingAuthorization('user@example.com');

    expect(payment).toHaveBeenCalledWith({
      customerKey: 'd1041d9d-3f23-42a4-88f6-26ef777e9dbb',
    });
    expect(requestBillingAuth).toHaveBeenCalledWith({
      method: 'CARD',
      successUrl: 'https://drop.example.com/billing/success',
      failUrl: 'https://drop.example.com/billing/fail',
      customerEmail: 'user@example.com',
    });
  });

  it('서버 오류 코드를 호출자가 구분할 수 있게 전달한다', async () => {
    const client = new BrowserBillingClient({
      getAccessToken: () => 'access-token-1',
      fetch: vi.fn().mockResolvedValue(
        createJsonResponse(
          {
            code: 'SUBSCRIPTION_NOT_FOUND',
            message: '취소할 구독이 없습니다.',
          },
          404
        )
      ),
      loadTossPayments: vi.fn(),
    });

    await expect(client.cancelSubscription()).rejects.toEqual(
      new BillingClientError('SUBSCRIPTION_NOT_FOUND', '취소할 구독이 없습니다.', 404)
    );
  });
});
